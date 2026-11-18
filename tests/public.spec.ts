import {expect,test} from '@playwright/test'
test.beforeEach(async({page})=>{
  await page.route('**/api/**',async route=>{
    if(route.request().method()==='POST'){
      expect(route.request().postDataJSON()).toMatchObject({name:'Synthetic Tester',consent:true,category:'general'})
      await route.fulfill({status:201,json:{data:{reference:'RN-SYNTHETIC'}}})
    }else if(route.request().url().endsWith('/auth/me')){
      await route.fulfill({status:401,json:{error:'Sign in to continue.'}})
    }else{
      await route.fulfill({json:{data:route.request().url().endsWith('/settings/public')?{}:[]}})
    }
  })
})
test('public navigation and the staged transportation inquiry',async({page})=>{
  await page.goto('/')
  await expect(page.getByRole('heading',{name:/Care in Motion/})).toBeVisible()
  await page.getByRole('link',{name:'Request Transport',exact:true}).first().click()
  await page.getByRole('button',{name:'Continue'}).click()
  await expect(page.getByText('Enter a valid email address.')).toBeVisible()
  await page.getByLabel('Contact name').fill('Synthetic Tester')
  await page.getByLabel('Email address').fill('test@example.invalid')
  await page.getByLabel('Phone number').fill('555-010-0100')
  await page.getByRole('button',{name:'Continue'}).click()
  await page.getByRole('button',{name:'Continue'}).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button',{name:'Submit Inquiry'}).click()
  await expect(page.getByText('RN-SYNTHETIC')).toBeVisible()
})
test('mobile menu and protected admin entry',async({page})=>{
  await page.setViewportSize({width:375,height:812})
  await page.goto('/')
  await page.getByRole('button',{name:'Open navigation'}).click()
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Careers'}).click()
  await expect(page.getByRole('heading',{name:'Careers at Rapid Nova'})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await page.goto('/admin')
  await expect(page.getByRole('heading',{name:'Staff sign-in'})).toBeVisible()
})
test('staff see only their permitted dashboard sections and actual response counts',async({page})=>{
  await page.route('**/api/auth/me',route=>route.fulfill({json:{data:{email:'dispatch@example.invalid',role:'Dispatch Staff',permissions:['operations']}}}))
  await page.route('**/api/admin/overview',route=>route.fulfill({json:{data:{counts:[{_id:'New',count:2}],referrals:1,applications:null,recent:[]}}}))
  await page.route('**/api/admin/transport?*',route=>route.fulfill({json:{data:[{_id:'synthetic-id',reference:'RN-SYNTHETIC',status:'New'}],total:1}}))
  await page.goto('/admin')
  const navigation=page.getByRole('navigation',{name:'Staff navigation'})
  await expect(navigation.getByRole('link',{name:'Transportation Inquiries'})).toBeVisible()
  await expect(navigation.getByRole('link',{name:'Users and Roles'})).toHaveCount(0)
  await expect(page.getByText('Total transportation inquiries').locator('..')).toContainText('2')
  await navigation.getByRole('link',{name:'Transportation Inquiries'}).click()
  await expect(page.getByRole('cell',{name:'RN-SYNTHETIC'})).toBeVisible()
})
test('photo carousel responds to buttons, keyboard and reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.goto('/')
  const gallery=page.getByRole('region',{name:'Medical transportation photos'})
  await expect(gallery.getByRole('img',{name:/crew members walking/})).toBeVisible()
  await gallery.getByRole('button',{name:'Next photo'}).click()
  await expect(gallery.getByRole('img',{name:/highway rest area/})).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(gallery.getByRole('button',{name:'Healthcare destinations'})).toHaveAttribute('aria-current','true')
  await gallery.getByRole('button',{name:'Next photo'}).click()
  await expect(gallery.getByRole('button',{name:'Medical transport crew'})).toHaveAttribute('aria-current','true')
  await page.goto('/careers')
  await expect(page.getByRole('region',{name:'Careers photo gallery'}).getByRole('button',{name:'Equipment preparation'})).toHaveAttribute('aria-current','true')
})
test('public pages and listing details display their lead photos', async ({page})=>{
  test.setTimeout(60_000)
  await page.emulateMedia({reducedMotion:'reduce'})
  const used=new Set<string>()
  async function checkPhoto(photo:ReturnType<typeof page.locator>){
    await photo.scrollIntoViewIfNeeded()
    await expect(photo).toHaveJSProperty('complete',true)
    await expect.poll(()=>photo.evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0)
    const src=await photo.getAttribute('src')
    expect(src).toBeTruthy()
    expect(used.has(src!)).toBe(false)
    used.add(src!)
  }
  async function checkGallery(name:string){
    const gallery=page.getByRole('region',{name})
    for(let index=0;index<3;index++){
      if(index) await gallery.getByRole('button',{name:'Next photo'}).click()
      await expect(gallery.getByRole('img')).toHaveCount(1)
      await checkPhoto(gallery.getByRole('img'))
    }
  }
  await page.goto('/')
  await checkPhoto(page.locator('.hero-image'))
  await checkPhoto(page.locator('.editorial-photo img'))
  await checkGallery('Medical transportation photos')
  for(const path of ['/about','/services','/service-areas','/patient-resources','/billing','/careers','/contact','/request-transport','/referrals','/privacy','/terms','/accessibility','/notice-of-privacy-practices']){
    await page.goto(path)
    await checkPhoto(page.locator('.intro-photo img'))
    if(path==='/careers') await checkGallery('Careers photo gallery')
  }
  await page.route('**/api/services/synthetic-service',route=>route.fulfill({json:{data:{title:'Synthetic service',description:'Test listing',image:'/team.jpg'}}}))
  await page.goto('/services/synthetic-service')
  await expect(page.locator('.intro-photo img')).toHaveAttribute('src','/team.jpg')
})
