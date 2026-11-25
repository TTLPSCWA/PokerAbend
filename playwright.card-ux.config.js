import {defineConfig,devices} from '@playwright/test';
import base from './playwright.config.js';
const {channel,...common}=base.use;
// Explicit opt-in suite; the ordinary project-wide browser configuration stays unchanged.
export default defineConfig({...base,testMatch:['card-ux*.spec.js','cards-visual.spec.js','phase10.spec.js','uno-ultimate.spec.js'],use:common,projects:[
  ...base.projects.map((p)=>({...p,use:{...p.use,browserName:'chromium',channel}})),
  {name:'webkit-iphone',use:{...devices['iPhone 13'],browserName:'webkit',viewport:{width:390,height:844}}},
  // CARD-UX-01: dritte Engine. Firefox kennt kein browserseitiges isMobile, daher nur Desktop und schmale Fenstergröße.
  {name:'firefox-desktop',use:{browserName:'firefox',viewport:{width:1440,height:900}}},
  {name:'firefox-schmal',use:{browserName:'firefox',viewport:{width:390,height:844}}},
]});
