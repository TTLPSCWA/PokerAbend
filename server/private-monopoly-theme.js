// Optional local-only theme preview. No private source or brand assets in public/.
import {readFileSync,realpathSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,join,sep,isAbsolute} from 'node:path';
import {themeRegistry,createThemeRegistry,useThemeRegistry} from '../public/games/monopoly/themes.js';
import {validateManifest} from '../public/games/monopoly/theme-manifest.js';
import {validateLayout} from '../public/games/monopoly/theme-layout.js';
import {themeAssets} from './theme-assets.js';
const local=ip=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip);
export function privateRequestAllowed(req){if(!local(req.socket.remoteAddress))return false;if(Object.keys(req.headers).some(k=>k==='forwarded'||k.startsWith('x-forwarded-')))return false;try{return ['127.0.0.1','localhost','[::1]'].includes(new URL('http://'+req.headers.host).hostname);}catch{return false;}}
export function configurePrivateMonopoly({dir=process.env.MONOPOLY_PRIVATE_THEME_DIR,host=process.env.HOST,dataDir=process.env.DATA_DIR,production=process.env.NODE_ENV==='production',repoRoot=fileURLToPath(new URL('..',import.meta.url))}={}){
 if(!dir)return null;
 if(production)throw Error('Private theme preview cannot run in production');
 if(host&&!['127.0.0.1','::1','localhost'].includes(host))throw Error('Private theme preview requires loopback binding');
 const root=realpathSync(dir),repo=realpathSync(repoRoot);if(root===repo||root.startsWith(repo+sep))throw Error('Private theme bundle must be outside the repository');
 if(!dataDir||!isAbsolute(dataDir)||!resolve(dataDir).startsWith(resolve(root,'..')+sep))throw Error('Private preview DATA_DIR must be under the private workspace, separate from production data');
 const json=f=>JSON.parse(readFileSync(join(root,f),'utf8')),definition=json('theme.json'),manifest=json('manifest.json'),layout=json('layout.json');
 if(definition.released!==false||manifest.release!=='draft'||manifest.assets.some(a=>a.origin.publication!=='private-only'||a.origin.licenseStatus==='cleared'))throw Error('Private preview must retain unpublished rights status');
 const errors=[...validateManifest(manifest),...validateLayout(layout)];if(errors.length)throw Error(errors.join('; '));
 for(const [slot,figure]of Object.entries(layout.figures)){const a=manifest.assets.find(a=>a.id===figure.assetId);if(!a||a.role!=='figure'||a.slot!==slot||a.source.width!==figure.width||a.source.height!==figure.height||!manifest.assets.some(a=>a.id===figure.portraitId))throw Error('Figure layout does not match manifest');}
 if(new Set(manifest.assets.filter(a=>a.role==='location').flatMap(a=>a.fieldIds)).size!==22||new Set(manifest.assets.filter(a=>a.role==='building').map(a=>a.slot)).size!==5)throw Error('Incomplete private scene');
 if(definition.id!==manifest.themeId||definition.manifest!==`/games/monopoly/themes/${definition.id}/manifest.json`)throw Error('Private theme ID mismatch');
 const prefix=`/games/monopoly/themes/${definition.id}`,allowed=new Set(['manifest.json','layout.json',...manifest.assets.flatMap(a=>a.variants.map(v=>'assets/'+v.file))]);
 for(const f of allowed){const real=realpathSync(join(root,f));if(!real.startsWith(root+sep)||!statSync(real).isFile())throw Error('Private asset escapes bundle');}
 for(const a of manifest.assets)for(const v of a.variants){const bytes=readFileSync(join(root,'assets',v.file));if(bytes.length!==v.bytes||createHash('sha256').update(bytes).digest('hex')!==v.sha256)throw Error('Private asset checksum mismatch');}
 const reset=useThemeRegistry(createThemeRegistry([...themeRegistry().list().filter(t=>t.id!==definition.id),definition],{privateThemes:[definition.id]})),images=themeAssets(root,{privateCache:true,flatTheme:true});
 return {host:host==='::1'?'::1':'127.0.0.1',definition,reset,allowRequest:privateRequestAllowed,guard(req,res,next){if(!privateRequestAllowed(req))return res.sendStatus(403);next();},mount(app){
  app.use(prefix,(req,res,next)=>{if(!local(req.socket.remoteAddress))return res.sendStatus(403);const f=req.path.slice(1);if(!allowed.has(f)||!['GET','HEAD'].includes(req.method))return res.sendStatus(404);res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');if(f.startsWith('assets/'))return images(req,res,()=>res.sendStatus(404));res.sendFile(join(root,f),{cacheControl:false,dotfiles:'deny'});});
 }};
}
