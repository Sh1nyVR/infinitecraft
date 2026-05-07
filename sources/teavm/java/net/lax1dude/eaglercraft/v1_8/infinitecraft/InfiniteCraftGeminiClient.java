package net.lax1dude.eaglercraft.v1_8.infinitecraft;

import org.teavm.jso.JSBody;
import org.teavm.jso.JSObject;
import org.teavm.jso.core.JSString;

public class InfiniteCraftGeminiClient {

	private static final String DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";

	public static void combine(String a, String b, InfiniteCraftCallback callback) {
		String apiKey = getGroqAPIKey("");
		InfiniteCraftJSCallback jsCallback = new InfiniteCraftJSCallback() {
			@Override
			public void complete(JSObject obj) {
				callback.onComplete(new InfiniteCraftResult(readString(obj, "name", "Mystery"),
						"block".equals(readString(obj, "kind", "block")), readStringArray(obj, "colors"),
						readStringArray(obj, "pixels"), readBoolean(obj, "generatedTexture", false)));
			}

			@Override
			public void texture(JSObject obj) {
				callback.onTexture(new InfiniteCraftResult(readString(obj, "name", "Mystery"),
						"block".equals(readString(obj, "kind", "block")), readStringArray(obj, "colors"),
						readStringArray(obj, "pixels"), readBoolean(obj, "generatedTexture", true)));
			}

			@Override
			public void failure(String msg) {
				callback.onFailure(msg);
			}
		};
		requestGroq(apiKey, getGroqModel(DEFAULT_GROQ_MODEL), a, b, jsCallback);
	}

	@JSBody(params = { "def" }, script = "return (typeof window.infiniteCraftGroqAPIKey === \"string\") ? window.infiniteCraftGroqAPIKey : def;")
	private static native String getGroqAPIKey(String def);

	@JSBody(params = { "def" }, script = "return (typeof window.infiniteCraftGroqModel === \"string\") ? window.infiniteCraftGroqModel : def;")
	private static native String getGroqModel(String def);

	@JSBody(params = { "obj", "key", "def" }, script = "return obj && typeof obj[key] === \"string\" ? obj[key] : def;")
	private static native String readString(JSObject obj, String key, String def);

	@JSBody(params = { "obj", "key", "def" }, script = "return obj && typeof obj[key] === \"boolean\" ? obj[key] : def;")
	private static native boolean readBoolean(JSObject obj, String key, boolean def);

	private static String[] readStringArray(JSObject obj, String key) {
		JSString[] arr = readStringArray0(obj, key);
		String[] ret = new String[arr.length];
		for (int i = 0; i < arr.length; ++i) {
			ret[i] = arr[i].stringValue();
		}
		return ret;
	}

	@JSBody(params = { "obj", "key" }, script = "return obj && Array.isArray(obj[key]) ? obj[key].map(function(v){ return String(v); }) : [];")
	private static native JSString[] readStringArray0(JSObject obj, String key);

	@JSBody(params = { "apiKey", "model", "a", "b", "cb" }, script = ""
			+ "function cleanName(v){ return String(v || '').replace(/[^a-zA-Z0-9 _\\'-]/g, '').trim().slice(0, 40) || 'Mystery'; }"
			+ "function cacheKey(x,y){ var p=[cleanName(x).toLowerCase(), cleanName(y).toLowerCase()].sort(); return 'infinitecraft.discovery.v6:' + p[0] + '+' + p[1]; }"
			+ "function localName(x,y){ var p=[cleanName(x),cleanName(y)], key=(p[0].toLowerCase()+'+'+p[1].toLowerCase()); var recipes={'fire+water':'Steam','earth+water':'Mud','earth+fire':'Lava','fire+wind':'Smoke','water+wind':'Wave','earth+wind':'Dust'}; return recipes[key]||recipes[p[1].toLowerCase()+'+'+p[0].toLowerCase()]||cleanName(p[0]+' '+p[1]); }"
			+ "function basePixels(o){ if(o.kind==='block'){ o.colors=['#6b6b6b','#8d8d8d','#4a4a4a','#b0b0b0']; o.pixels=['2222222222222222','2111111111111112','2100000000000012','2103333333333012','2103000000003012','2103033333303012','2103030000303012','2103030330303012','2103030000303012','2103033333303012','2103000000003012','2103333333333012','2100000000000012','2111111111111112','2222222222222222','2222222222222222']; } else { o.colors=['#000000','#f4f4f4','#bdbdbd','#777777']; o.pixels=['0000000000000000','0000011111100000','0000111111110000','0001112221111000','0011123332111100','0011233333211100','0011232223211100','0011122222111100','0001111111111000','0000111111110000','0000011111100000','0000001111000000','0000000110000000','0000000000000000','0000000000000000','0000000000000000']; } o.generatedTexture=false; return o; }"
			+ "function fallbackPixels(o){ var h=2166136261,s=o.name+':'+o.kind; for(var i=0;i<s.length;++i){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } o.colors=o.colors&&o.colors.length?o.colors:['#777777','#aaaaaa','#444444','#ffffff']; o.pixels=[]; for(var y=0;y<16;++y){ var row=''; for(var x=0;x<16;++x){ h^=h<<13; h^=h>>>17; h^=h<<5; var dx=x-7.5,dy=y-7.5,d=Math.sqrt(dx*dx+dy*dy); var idx=(o.kind!=='block'&&d>7.4)?0:Math.abs((h+x+y)%o.colors.length); row+=String(idx); } o.pixels.push(row); } return o; }"
			+ "function pixelate(img,o){ var c=document.createElement('canvas'),ctx=c.getContext('2d',{willReadFrequently:true}); c.width=16;c.height=16;ctx.imageSmoothingEnabled=true;ctx.clearRect(0,0,16,16);ctx.drawImage(img,0,0,16,16); var data=ctx.getImageData(0,0,16,16).data; var palette=[], rows=[]; function hx(n){ n=Math.max(0,Math.min(255,n|0)).toString(16); return n.length<2?'0'+n:n; } function dist(a,r,g,b){ var dr=a[0]-r,dg=a[1]-g,db=a[2]-b; return dr*dr+dg*dg+db*db; } for(var y=0;y<16;++y){ var row=''; for(var x=0;x<16;++x){ var p=(y*16+x)*4,r=data[p],g=data[p+1],b=data[p+2],best=-1,bd=1e9; for(var i=0;i<palette.length;++i){ var d=dist(palette[i],r,g,b); if(d<bd){bd=d;best=i;} } if(best<0||palette.length<8&&bd>1800){ palette.push([r,g,b]); best=palette.length-1; } row+=String(best); } rows.push(row); } var first=rows[0].charAt(0),blank=true; for(var yy=0;yy<16;++yy)for(var xx=0;xx<16;++xx)if(rows[yy].charAt(xx)!==first)blank=false; if(blank)throw new Error('blank image'); o.colors=palette.map(function(p){return '#'+hx(p[0])+hx(p[1])+hx(p[2]);}); while(o.colors.length<2)o.colors.push('#ffffff'); o.pixels=rows; return o; }"
			+ "function saveFinal(o){ try{ localStorage.setItem(cacheKey(a,b), JSON.stringify(o)); }catch(e){} cb.texture(o); }"
			+ "function finishFast(o){ try{ localStorage.setItem(cacheKey(a,b)+':pending', JSON.stringify(o)); }catch(e){} cb.complete(o); }"
			+ "function finishTexture(o){ var art='pixel art 16x16 Minecraft '+o.kind+' icon of '+o.name+', created by combining '+a+' and '+b+', centered, readable silhouette, crisp square pixels, no text, no letters, transparent or simple background'; function fallback(){ var done=(o.colors&&o.pixels)?o:fallbackPixels(o); done.generatedTexture=true; saveFinal(done); } if(window.puter&&puter.ai&&puter.ai.txt2img){ return puter.ai.txt2img(art,{model:'black-forest-labs/flux-schnell'}).then(function(img){ var done=pixelate(img,o); done.generatedTexture=true; saveFinal(done); },function(){ return puter.ai.txt2img(art,{model:'gpt-image-1-mini',quality:'low'}).then(function(img){ var done=pixelate(img,o); done.generatedTexture=true; saveFinal(done); },fallback); }); } fallback(); }"
			+ "try{ var cached=localStorage.getItem(cacheKey(a,b)); if(cached){ cb.complete(JSON.parse(cached)); return; } }catch(e){}"
			+ "var proxy=(typeof window.infiniteCraftGroqProxyURL==='string'?window.infiniteCraftGroqProxyURL:(window.location&&window.location.protocol==='file:'?'http://localhost:8787/combine':'/combine')); if(proxy){ fetch(proxy,{method:'POST',mode:'cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({a:a,b:b})}).then(function(r){ if(!r.ok)return r.text().then(function(t){throw new Error('Proxy HTTP '+r.status+' '+String(t).slice(0,180));}); return r.json(); }).then(function(o){ o.name=cleanName(o.name); o.kind=o.kind==='item'?'item':'block'; finishFast(basePixels({name:o.name,kind:o.kind})); return finishTexture(o); }).catch(function(err){ cb.failure(String(err&&err.message?err.message:err)); }); return; }"
			+ "if(!apiKey){ cb.failure('Groq API key missing'); return; }"
			+ "var prompt='You are the crafting logic for an Infinite Craft style Minecraft mod. Combine \"'+a+'\" and \"'+b+'\" into exactly one new discovery. Think like Infinite Craft: surprising, culturally recognizable, funny, iconic, and aware of memes, Gen Z/Gen Alpha slang, games, fandoms, brands, shows, internet trends. Examples: Delta + Rune -> Deltarune; Skibidi + Toilet -> Skibidi Toilet; Fanum + Tax -> Fanum Tax; Ohio + Rizz -> Sigma; Fire + Water -> Steam; Earth + Water -> Mud. Avoid joining words unless that phrase is the real result. For kind, prefer block for natural materials, terrain, plants, ores, wood, stone, building materials, furniture, machines, containers, structures, or placeable things. Use item for tools, weapons, food, handheld things, abstract concepts, liquids/gases/energy alone, or media references that should not be placeable. Grass + Wood -> block. Dirt + Shovel -> item. Return only JSON: {\"name\":\"short title case name\",\"kind\":\"block or item\"}.';"
			+ "fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',mode:'cors',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},body:JSON.stringify({model:model,messages:[{role:'user',content:prompt}],temperature:0.7,max_completion_tokens:80})})"
			+ ".then(function(r){ if(!r.ok)return r.text().then(function(t){throw new Error('HTTP '+r.status+' '+String(t).slice(0,180));}); return r.json(); })"
			+ ".then(function(j){ var t=j&&j.choices&&j.choices[0]&&j.choices[0].message?j.choices[0].message.content:'{}'; var o; try{o=JSON.parse(t);}catch(e){var m=String(t).match(/\\{[\\s\\S]*\\}/);o=m?JSON.parse(m[0]):{};} o.name=cleanName(o.name); o.kind=o.kind==='item'?'item':'block'; finishFast(basePixels({name:o.name,kind:o.kind})); return finishTexture(o); })"
			+ ".catch(function(err){ cb.failure(String(err&&err.message?err.message:err)); });")
	private static native void requestGroq(String apiKey, String model, String a, String b, InfiniteCraftJSCallback cb);

	private interface InfiniteCraftJSCallback extends JSObject {
		void complete(JSObject obj);

		void texture(JSObject obj);

		void failure(String msg);
	}
}
