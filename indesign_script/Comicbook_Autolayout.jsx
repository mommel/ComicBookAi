/** 
 * Comicbook_Autolayout.jsx
 * Requires ImageFolder with Images that follow the Name Pattern WHATEVER-IMAGEID-IMAGEVARIANT
 * Per IMAGEID it should have as many Imagevariants as possible 
 * Imagevariants are:
 *  (h)orizontal 7:5 
 *  (s)quare 1:1 
 *  (v)ertical 5:7
 *  (n)arrpw 5:14
 */
(function(){
  var PAGE_W=2480, PAGE_H=3508;
  var OUTER_PAD=30;
  var INNER_PAD=10;
  var STROKE_PT=0.5;
  var PREF_FILE_NAME = "A4_RandomLayout_LastImageDir.txt";
  var APP_LABEL_KEY  = "A4_LAST_IMG_DIR";

  function trimStr(s){ return (s==null?"":String(s)).replace(/^\s+|\s+$/g,""); }
  function ensureUnits(){
    app.scriptPreferences.measurementUnit=MeasurementUnits.POINTS;
    app.viewPreferences.horizontalMeasurementUnits=MeasurementUnits.POINTS;
    app.viewPreferences.verticalMeasurementUnits=MeasurementUnits.POINTS;
    app.viewPreferences.rulerOrigin=RulerOrigin.PAGE_ORIGIN;
  }
  function getBlackSwatch(doc){
    var names=["Black","[Black]","Schwarz","[Schwarz]"];
    for(var i=0;i<names.length;i++){ try{ return doc.swatches.itemByName(names[i]); }catch(e){} }
    try{ return doc.swatches.itemByName("Registration"); }catch(e){}
    return doc.swatches.item(0);
  }
  function makeDoc(){
    ensureUnits();
    var d=app.documents.add();
    d.documentPreferences.properties={pagesPerDocument:1,facingPages:false,pageWidth:PAGE_W,pageHeight:PAGE_H,pageOrientation:PageOrientation.portrait};
    d.marginPreferences.properties={top:OUTER_PAD,left:OUTER_PAD,right:OUTER_PAD,bottom:OUTER_PAD};
    d.documentPreferences.documentBleedTopOffset=0;
    d.documentPreferences.documentBleedBottomOffset=0;
    d.documentPreferences.documentBleedInsideOrLeftOffset=0;
    d.documentPreferences.documentBleedOutsideOrRightOffset=0;
    return d;
  }
  function fitSmart(rect){ 
    try{ if(FitOptions && FitOptions.CONTENT_AWARE_FIT){ rect.fit(FitOptions.CONTENT_AWARE_FIT); return; } }catch(_e){}
    try{ if(FitOptions && FitOptions.FILL_PROPORTIONALLY){ rect.fit(FitOptions.FILL_PROPORTIONALLY); rect.fit(FitOptions.CENTER_CONTENT); return; } }catch(_e){}
    try{ rect.fit(FitOptions.PROPORTIONALLY); rect.fit(FitOptions.CENTER_CONTENT); }catch(_e){}
    try{
      if(rect.graphics.length>0){
        var gb=rect.geometricBounds; var fw=gb[3]-gb[1]; var fh=gb[2]-gb[0];
        var vb=rect.graphics[0].visibleBounds;
        var cw=vb[3]-vb[1]; var ch=vb[2]-vb[0];
        if(cw>0 && ch>0){
          var scale=Math.max(fw/cw, fh/ch)*100;
          rect.graphics[0].absoluteHorizontalScale=scale;
          rect.graphics[0].absoluteVerticalScale=scale;
          rect.fit(FitOptions.CENTER_CONTENT);
        }
      }
    }catch(_e){}
  }
  // last-folder helpers
  function getPrefsFile(){
    var dir = Folder.userData; if(!dir.exists) dir.create(); return File(dir.fsName + "/" + PREF_FILE_NAME);
  }
  function readLastFolder(){
    try{ var s=app.extractLabel(APP_LABEL_KEY); if(s && trimStr(s).length) return new Folder(trimStr(s)); }catch(_e){}
    try{ var f=getPrefsFile(); if(f.exists){ f.encoding="UTF-8"; if(f.open("r")){ var t=f.read(); f.close(); t=trimStr(t); if(t) return new Folder(t); } } }catch(_e){}
    return null;
  }
  function writeLastFolder(folder){
    var p = folder && folder.fsName ? folder.fsName : "";
    try{ app.insertLabel(APP_LABEL_KEY, p); }catch(_e){}
    try{ var f=getPrefsFile(); f.encoding="UTF-8"; if(f.open("w")){ f.write(p); f.close(); } }catch(_e){}
  }
  function chooseStartFolder(prompt){
    var last = readLastFolder();
    var f = null;
    try{ if(last && last.exists){ Folder.current = last; f = Folder.selectDialog(prompt); } }catch(_e){}
    if(!f){ try{ f = Folder.selectDialog(prompt); }catch(_e){} }
    return f;
  }

  function naturalKey(name){
    name = String(name).toLowerCase();
    var parts = name.match(/\d+|\D+/g) || [name];
    for(var i=0;i<parts.length;i++) if(/^\d+$/.test(parts[i])) parts[i]=parseInt(parts[i],10);
    return parts;
  }
  function naturalCompare(a, b){
    var an = (a.name!=null)? a.name : String(a);
    var bn = (b.name!=null)? b.name : String(b);
    var A=naturalKey(an), B=naturalKey(bn);
    var n=Math.min(A.length,B.length);
    for(var i=0;i<n;i++){ var x=A[i], y=B[i];
      if(x===y) continue;
      var xn=(typeof x==="number"), yn=(typeof y==="number");
      if(xn&&yn) return x-y;
      x=String(x); y=String(y);
      if(x<y) return -1; if(x>y) return 1;
    }
    return A.length - B.length;
  }
  function classifyFrame(rect){
    var gb=rect.geometricBounds; var w=gb[3]-gb[1]; var h=gb[2]-gb[0];
    if(h<=0||w<=0) return "s";
    var r=w/h, EPS=0.06;
    function near(a,b){ return Math.abs(a-b) <= EPS*b; }
    if(near(r,1)) return "s";
    if(near(r,7/5)) return "h";
    if(near(r,5/7)) return "v";
    if(near(r,5/14)) return "n";
    if(r>1.18) return "h";
    if(r<0.5)  return "n";
    return "v";
  }

var LAYOUTS = [
  {id:4,totalImages:8,numRows:3,imagesPerRowTopDown:"4 + 2 + 2",rows:[{rowIndex:1,h:1712,widths:[628,616,608,608],items:"608x1692;608x1692;608x1692;608x1692"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:888,widths:[1234,1226],items:"1214x868;1214x868"}]},
  {id:7,totalImages:8,numRows:3,imagesPerRowTopDown:"4 + 2 + 2",rows:[{rowIndex:1,h:1712,widths:[628,616,608,608],items:"608x1692;608x1692;608x1692;608x1692"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:888,widths:[1234,1226],items:"1214x868;1214x868"}]},
  {id:25,totalImages:8,numRows:3,imagesPerRowTopDown:"1 + 4 + 3",rows:[{rowIndex:1,h:1751,widths:[2479],items:"2479x1771"},{rowIndex:2,h:874,widths:[630,610,610,610],items:"610x854;610x854;610x854;610x854"},{rowIndex:3,h:863,widths:[1234,616,610],items:"1214x868;610x854;610x854"}]},
  {id:50,totalImages:8,numRows:3,imagesPerRowTopDown:"1 + 3 + 4",rows:[{rowIndex:1,h:1751,widths:[2479],items:"2479x1771"},{rowIndex:2,h:874,widths:[1234,616,610],items:"1214x868;610x854;610x854"},{rowIndex:3,h:863,widths:[630,610,610,610],items:"610x854;610x854;610x854;610x854"}]},
  {id:78,totalImages:8,numRows:3,imagesPerRowTopDown:"1 + 3 + 4",rows:[{rowIndex:1,h:1751,widths:[2479],items:"2479x1771"},{rowIndex:2,h:874,widths:[1234,616,610],items:"1214x868;610x854;610x854"},{rowIndex:3,h:863,widths:[630,610,610,610],items:"610x854;610x854;610x854;610x854"}]},
  {id:91,totalImages:8,numRows:3,imagesPerRowTopDown:"4 + 2 + 2",rows:[{rowIndex:1,h:1712,widths:[628,616,608,608],items:"608x1692;608x1692;608x1692;608x1692"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:888,widths:[1234,1226],items:"1214x868;1214x868"}]},
  {id:104,totalImages:8,numRows:3,imagesPerRowTopDown:"1 + 3 + 4",rows:[{rowIndex:1,h:1751,widths:[2479],items:"2479x1771"},{rowIndex:2,h:874,widths:[1234,616,610],items:"1214x868;610x854;610x854"},{rowIndex:3,h:863,widths:[630,610,610,610],items:"610x854;610x854;610x854;610x854"}]},
  {id:136,totalImages:8,numRows:3,imagesPerRowTopDown:"4 + 2 + 2",rows:[{rowIndex:1,h:1712,widths:[628,616,608,608],items:"608x1692;608x1692;608x1692;608x1692"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:888,widths:[1234,1226],items:"1214x868;1214x868"}]},
  {id:148,totalImages:8,numRows:3,imagesPerRowTopDown:"4 + 2 + 2",rows:[{rowIndex:1,h:1712,widths:[628,616,608,608],items:"608x1692;608x1692;608x1692;608x1692"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:888,widths:[1234,1226],items:"1214x868;1214x868"}]},
  {id:155,totalImages:8,numRows:3,imagesPerRowTopDown:"4 + 2 + 2",rows:[{rowIndex:1,h:1712,widths:[628,616,608,608],items:"608x1692;608x1692;608x1692;608x1692"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:888,widths:[1234,1226],items:"1214x868;1214x868"}]},
  {id:19,totalImages:8,numRows:4,imagesPerRowTopDown:"2 + 2 + 2 + 2",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:864,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:4,h:848,widths:[1234,1226],items:"1214x868;1214x868"}]},
  {id:34,totalImages:8,numRows:4,imagesPerRowTopDown:"2 + 2 + 2 + 2",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:864,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:4,h:848,widths:[1234,1226],items:"1214x868;1214x868"}]},
  {id:118,totalImages:8,numRows:4,imagesPerRowTopDown:"2 + 2 + 2 + 2",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:864,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:4,h:848,widths:[1234,1226],items:"1214x868;1214x868"}]},
  {id:134,totalImages:8,numRows:4,imagesPerRowTopDown:"2 + 2 + 2 + 2",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:864,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:4,h:848,widths:[1234,1226],items:"1214x868;1214x868"}]},
  {id:137,totalImages:8,numRows:4,imagesPerRowTopDown:"2 + 2 + 2 + 2",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:864,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:4,h:848,widths:[1234,1226],items:"1214x868;1214x868"}]},
  {id:47,totalImages:9,numRows:3,imagesPerRowTopDown:"1 + 4 + 4",rows:[{rowIndex:1,h:1751,widths:[2479],items:"2479x1771"},{rowIndex:2,h:874,widths:[630,610,610,610],items:"610x854;610x854;610x854;610x854"},{rowIndex:3,h:863,widths:[630,610,610,610],items:"610x854;610x854;610x854;610x854"}]},
  {id:99,totalImages:9,numRows:3,imagesPerRowTopDown:"1 + 4 + 4",rows:[{rowIndex:1,h:1751,widths:[2479],items:"2479x1771"},{rowIndex:2,h:874,widths:[630,610,610,610],items:"610x854;610x854;610x854;610x854"},{rowIndex:3,h:863,widths:[630,610,610,610],items:"610x854;610x854;610x854;610x854"}]},
  {id:131,totalImages:9,numRows:3,imagesPerRowTopDown:"1 + 4 + 4",rows:[{rowIndex:1,h:1751,widths:[2479],items:"2479x1771"},{rowIndex:2,h:874,widths:[630,610,610,610],items:"610x854;610x854;610x854;610x854"},{rowIndex:3,h:863,widths:[630,610,610,610],items:"610x854;610x854;610x854;610x854"}]},
  {id:16,totalImages:9,numRows:4,imagesPerRowTopDown:"2 + 2 + 3 + 2",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:878,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:874,widths:[1234,616,610],items:"1214x868;610x854;610x854"},{rowIndex:4,h:848,widths:[1234,1226],items:"1214x868;1214x868"}]},
  {id:27,totalImages:9,numRows:4,imagesPerRowTopDown:"2 + 2 + 2 + 3",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:864,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:4,h:848,widths:[1234,616,610],items:"1214x868;610x854;610x854"}]},
  {id:36,totalImages:9,numRows:4,imagesPerRowTopDown:"2 + 2 + 2 + 3",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:864,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:4,h:848,widths:[1234,616,610],items:"1214x868;610x854;610x854"}]},
  {id:40,totalImages:9,numRows:4,imagesPerRowTopDown:"2 + 2 + 2 + 3",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:864,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:4,h:848,widths:[1234,616,610],items:"1214x868;610x854;610x854"}]},
  {id:54,totalImages:9,numRows:4,imagesPerRowTopDown:"2 + 2 + 3 + 2",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:878,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:874,widths:[1234,616,610],items:"1214x868;610x854;610x854"},{rowIndex:4,h:848,widths:[1234,1226],items:"1214x868;1214x868"}]},
  {id:62,totalImages:9,numRows:4,imagesPerRowTopDown:"2 + 2 + 3 + 2",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:864,widths:[1234,616,610],items:"1214x868;610x854;610x854"},{rowIndex:4,h:848,widths:[1234,1226],items:"1214x868;1214x868"}]},
  {id:124,totalImages:9,numRows:4,imagesPerRowTopDown:"2 + 2 + 2 + 3",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:864,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:4,h:848,widths:[1234,616,610],items:"1214x868;610x854;610x854"}]},
  {id:144,totalImages:9,numRows:4,imagesPerRowTopDown:"2 + 2 + 2 + 3",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:864,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:4,h:848,widths:[1234,616,610],items:"1214x868;610x854;610x854"}]},
  {id:3,totalImages:10,numRows:4,imagesPerRowTopDown:"2 + 2 + 2 + 4",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:878,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:4,h:834,widths:[630,610,610,610],items:"610x854;610x854;610x854;610x854"}]},
  {id:24,totalImages:10,numRows:4,imagesPerRowTopDown:"2 + 2 + 3 + 3",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:878,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:874,widths:[1234,616,610],items:"1214x868;610x854;610x854"},{rowIndex:4,h:848,widths:[1234,616,610],items:"1214x868;610x854;610x854"}]},
  {id:43,totalImages:10,numRows:4,imagesPerRowTopDown:"2 + 3 + 3 + 2",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:874,widths:[1234,616,610],items:"1214x868;610x854;610x854"},{rowIndex:3,h:874,widths:[1234,616,610],items:"1214x868;610x854;610x854"},{rowIndex:4,h:852,widths:[1234,1226],items:"1214x868;1214x868"}]},
  {id:44,totalImages:10,numRows:4,imagesPerRowTopDown:"2 + 2 + 2 + 4",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:878,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:4,h:834,widths:[630,610,610,610],items:"610x854;610x854;610x854;610x854"}]},
  {id:63,totalImages:10,numRows:4,imagesPerRowTopDown:"2 + 2 + 3 + 3",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:878,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:874,widths:[1234,616,610],items:"1214x868;610x854;610x854"},{rowIndex:4,h:848,widths:[1234,616,610],items:"1214x868;610x854;610x854"}]},
  {id:64,totalImages:10,numRows:4,imagesPerRowTopDown:"2 + 2 + 3 + 3",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:864,widths:[1234,616,610],items:"1214x868;610x854;610x854"},{rowIndex:4,h:848,widths:[1234,616,610],items:"1214x868;610x854;610x854"}]},
  {id:79,totalImages:10,numRows:4,imagesPerRowTopDown:"2 + 2 + 4 + 2",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:878,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:874,widths:[630,610,610,610],items:"610x854;610x854;610x854;610x854"},{rowIndex:4,h:848,widths:[1234,1226],items:"1214x868;1214x868"}]},
  {id:80,totalImages:10,numRows:4,imagesPerRowTopDown:"2 + 2 + 3 + 3",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:864,widths:[1234,616,610],items:"1214x868;610x854;610x854"},{rowIndex:4,h:848,widths:[1234,616,610],items:"1214x868;610x854;610x854"}]},
  {id:89,totalImages:10,numRows:4,imagesPerRowTopDown:"2 + 2 + 2 + 4",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:878,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:4,h:834,widths:[630,610,610,610],items:"610x854;610x854;610x854;610x854"}]},
  {id:102,totalImages:10,numRows:4,imagesPerRowTopDown:"2 + 2 + 4 + 2",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:864,widths:[630,610,610,610],items:"610x854;610x854;610x854;610x854"},{rowIndex:4,h:848,widths:[1234,1226],items:"1214x868;1214x868"}]},
  {id:106,totalImages:10,numRows:4,imagesPerRowTopDown:"2 + 2 + 3 + 3",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:864,widths:[1234,616,610],items:"1214x868;610x854;610x854"},{rowIndex:4,h:848,widths:[1234,616,610],items:"1214x868;610x854;610x854"}]},
  {id:113,totalImages:10,numRows:4,imagesPerRowTopDown:"2 + 2 + 2 + 4",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:878,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:4,h:834,widths:[630,610,610,610],items:"610x854;610x854;610x854;610x854"}]},
  {id:115,totalImages:10,numRows:4,imagesPerRowTopDown:"2 + 2 + 3 + 3",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:864,widths:[1234,616,610],items:"1214x868;610x854;610x854"},{rowIndex:4,h:848,widths:[1234,616,610],items:"1214x868;610x854;610x854"}]},
  {id:116,totalImages:10,numRows:4,imagesPerRowTopDown:"2 + 2 + 3 + 3",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:864,widths:[1234,616,610],items:"1214x868;610x854;610x854"},{rowIndex:4,h:848,widths:[1234,616,610],items:"1214x868;610x854;610x854"}]},
  {id:128,totalImages:10,numRows:4,imagesPerRowTopDown:"2 + 2 + 4 + 2",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:878,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:874,widths:[630,610,610,610],items:"610x854;610x854;610x854;610x854"},{rowIndex:4,h:848,widths:[1234,1226],items:"1214x868;1214x868"}]},
  {id:149,totalImages:10,numRows:4,imagesPerRowTopDown:"2 + 2 + 2 + 4",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:3,h:878,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:4,h:834,widths:[630,610,610,610],items:"610x854;610x854;610x854;610x854"}]},
  {id:157,totalImages:10,numRows:4,imagesPerRowTopDown:"2 + 3 + 3 + 2",rows:[{rowIndex:1,h:888,widths:[1234,1226],items:"1214x868;1214x868"},{rowIndex:2,h:874,widths:[1234,616,610],items:"1214x868;610x854;610x854"},{rowIndex:3,h:874,widths:[1234,616,610],items:"1214x868;610x854;610x854"},{rowIndex:4,h:852,widths:[1234,1226],items:"1214x868;1214x868"}]}
];

  function buildFramesForLayout(doc, page, pick, black, noneSw){
    var CX=OUTER_PAD, CY=OUTER_PAD;
    var CW=PAGE_W - 2*OUTER_PAD;
    var CH=PAGE_H - 2*OUTER_PAD;

    var totalH=0; for(var r=0;r<pick.rows.length;r++) totalH += pick.rows[r].h;
    var scaleY = CH / totalH;

    var frames=[], y=CY;
    for(var r=0;r<pick.rows.length;r++){
      var R=pick.rows[r];
      var rowH = Math.max(1, Math.round(R.h * scaleY));
      if(r===pick.rows.length-1) rowH = (CY + CH) - y;

      var sumW=0; for(var i=0;i<R.widths.length;i++) sumW += R.widths[i];
      var scaleX = CW / sumW;
      var scaled=[]; for(var i=0;i<R.widths.length;i++) scaled.push(Math.max(1, Math.round(R.widths[i]*scaleX)));
      var diff = CW - (function(a){ for(var i=0,s=0;i<a.length;i++) s+=a[i]; return s; })(scaled);
      if(scaled.length>0) scaled[scaled.length-1]+=diff;

      var x=CX;
      for(var c=0;c<scaled.length;c++){
        var w=scaled[c];
        var top=y, left=x, bottom=y+rowH, right=x+w;
        var itop=top+INNER_PAD, ileft=left+INNER_PAD, ibottom=bottom-INNER_PAD, iright=right-INNER_PAD;
        if(ibottom-itop<1) ibottom=itop+1;
        if(iright-ileft<1) iright=ileft+1;
        var rect=page.rectangles.add();
        rect.geometricBounds=[itop, ileft, ibottom, iright];
        rect.strokeWeight=STROKE_PT; rect.strokeColor=black; rect.fillColor=noneSw;
        frames.push(rect);
        x += w;
      }
      y += rowH;
    }
    return frames;
  }

  // 1) Folder first
  var folder = chooseStartFolder("Bildordner wählen (PNG/JPG/TIFF)");
  if(!folder){ alert("Abgebrochen: Kein Ordner gewählt."); return; }
  writeLastFolder(folder);

  // 2) Pool aufbauen
  var re = /(.*)-(\d+)-(h|v|n|s)\.(png|jpg|tiff)$/i;
  var all = folder.getFiles(function(f){ if(!(f instanceof File)) return false; return re.test(f.name); });
  if(!all || !all.length){ alert("Keine passenden Dateien gefunden (Regex: /(.*)-(\\d+)-(h|v|n|s)\\.(png|jpg|tiff)$/i)."); return; }
  try{ all.sort(naturalCompare); }catch(_e){}

  var pool={s:{}, h:{}, v:{}, n:{}};
  var seen={};
  for(var i=0;i<all.length;i++){
    var f=all[i]; var m = re.exec(f.name); if(!m) continue;
    var counter = parseInt(m[2],10);
    var variant = (m[3]||"").toLowerCase();
    if(!pool[variant]) pool[variant]={};
    if(!pool[variant].hasOwnProperty(counter)){
      pool[variant][counter]=f;
      seen[counter]=true;
    }
  }
  var counters=[]; for(var k in seen) if(seen.hasOwnProperty(k)) counters.push(parseInt(k,10));
  counters.sort(function(a,b){ return a-b; });
  if(!counters.length){ alert("Keine Zählernummern gefunden."); return; }

  // 3) Doc + Swatches
  var doc=makeDoc();
  var black=getBlackSwatch(doc);
  var noneSw=doc.swatches.itemByName("None");

  // 4) Seiten anlegen & füllen
  var pri = { "h":["h","s","v","n"], "s":["s","h","v","n"], "v":["v","s","n","h"], "n":["v","s","h","n"] };
  var placedCount=0, framesTotal=0, pageCount=0, idx=0;

  while(idx < counters.length){
    var pick = LAYOUTS[Math.floor(Math.random()*LAYOUTS.length)];
    var page = (pageCount===0)? doc.pages[0] : doc.pages.add();
    pageCount++;
    var frames = buildFramesForLayout(doc, page, pick, black, noneSw);
    framesTotal += frames.length;

    for(var fi=0; fi<frames.length && idx < counters.length; fi++){
      var rect = frames[fi];
      var kind = classifyFrame(rect);
      var order = pri[kind] || ["s","h","v","n"];
      var chosenFile=null, usedCounter=null;

      while(idx < counters.length && !chosenFile){
        var cnt = counters[idx];
        for(var oi=0; oi<order.length && !chosenFile; oi++){
          var tag=order[oi];
          var table=pool[tag];
          if(table && table.hasOwnProperty(cnt)){ chosenFile=table[cnt]; }
        }
        if(chosenFile){ usedCounter=cnt; break; }
        else { idx++; }
      }
      if(!chosenFile) break;
      try{ rect.place(chosenFile); fitSmart(rect); placedCount++; }catch(_e){}
      var letters=["s","h","v","n"];
      for(var li=0; li<letters.length; li++){ var t=pool[letters[li]]; if(t && t.hasOwnProperty(usedCounter)) delete t[usedCounter]; }
      idx++;
    }
  }

  alert("Fertig!\nSeiten: "+(doc.pages.length)+" | Platzierte Bilder: "+placedCount+" | Frames gesamt: "+framesTotal);
})();
