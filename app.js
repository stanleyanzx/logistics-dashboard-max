// ============ 数据 ============
var BOX_FIELDS = RAW.box.fields;
var BOX_ROWS = RAW.box.rows;
var SKU_FIELDS = RAW.sku.fields;
var SKU_ROWS = RAW.sku.rows;
var FR_FIELDS = RAW.freight.fields;
var FR_ROWS = RAW.freight.rows;
var TIME_MAP = RAW.timeMap || {};
var BOX_TYPES = RAW.boxTypes || {};

var boxData = BOX_ROWS.map(function(r){ var o={}; BOX_FIELDS.forEach(function(f,i){o[f]=r[i];}); return o; });
var skuData = SKU_ROWS.map(function(r){ var o={}; SKU_FIELDS.forEach(function(f,i){o[f]=r[i];}); return o; });
var frData = FR_ROWS.map(function(r){ var o={}; FR_FIELDS.forEach(function(f,i){o[f]=r[i];}); return o; });

// ===== Tab2数据预处理：排除发货仓库=160，快船→海运（仅影响Tab2，不影响Tab1）=====
var t2BoxData = boxData.filter(function(d){return String(d['发货仓库']).trim()!=='160'&&String(d['物流状态']).trim()!=='终止';});
t2BoxData = t2BoxData.map(function(d){var o={};for(var k in d)o[k]=d[k];if(String(o['运输类型']).trim()==='快船')o['运输类型']='海运';return o;});

// ===== Tab3数据预处理：排除入库单号为空的行 =====
frData = frData.filter(function(d){return d['入库单号']&&String(d['入库单号']).trim()!=='';});

// ===== Tab2达标率计算：自算时效天数 vs PERIOD_LIMITS =====
var PERIOD_LIMITS={'4天':7,'7天':9,'8天':8,'10天':12,'11天':13,'15天':15,'18天':18,'30天':32,'38天':38,'4':7,'7':9,'8':8,'10':12,'11':13,'15':15,'18':18,'30':32,'38':38};
function calcTransitDays(d){var t1=parseDate(d['提货时间']);if(!t1)return null;var whType=String(d['仓库类型']||'').trim();var t2;if(whType==='万邑通'){t2=parseDate(d['上架时间']);}else{t2=parseDate(d['签收时间']);}if(!t2){var st=String(d['物流状态']||'').trim();if(st==='运输中'||st==='待上架'||st==='已到仓（亚马逊/FBT）')t2=new Date();else return null;}var days=Math.floor((t2.getTime()-t1.getTime())/86400000);return isNaN(days)?null:days;}
function isCompliant(d){var p=String(d['时效要求']||'').trim();var days=calcTransitDays(d);if(!p||p==='nan'||p==='NaT'||days===null||isNaN(days))return null;var limit=PERIOD_LIMITS[p];if(limit===undefined)limit=PERIOD_LIMITS[p.replace('天','')];if(limit===undefined)limit=PERIOD_LIMITS[p.replace('.0','')];if(limit===undefined)limit=PERIOD_LIMITS[p.replace('.0','')+'天'];if(limit===undefined)return null;return days<=limit;}
function isValidStat(d){var p=String(d['时效要求']||'').trim();var days=calcTransitDays(d);return !!p&&p!=='nan'&&p!=='NaT'&&days!==null&&!isNaN(days)&&days>=0;}
function isExc(d){return isCompliant(d)===false;}
function isChk(d){return d['是否查验']==='是'||d['是否查验']==='查验'||d['是否查验']===1;}
function qtyOf(d){var n=Number(d['计划数量']);return isNaN(n)?0:n;}

var PALETTE = ['#7c3aed','#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe','#6d28d9','#5b21b6','#9333ea','#7e22ce','#a855f7','#b67def','#d8b4fe','#581c87','#3b0764','#e9d5ff','#f3e8ff','#6b21a8'];

function getBoxTime(inNo, boxNo){ return TIME_MAP[inNo+'|'+boxNo] || null; }
function fmtT(s){ s=String(s||''); if(!s||s==='nan'||s==='NaT') return '-'; return s.length>10?s.slice(0,10):s; }
function uniqueVals(arr, field){ var s={}; arr.forEach(function(d){ var v=d[field]; if(v!==''&&v!=null) s[v]=1; }); return Object.keys(s); }
function escapeAttr(s){ return String(s).replace(/"/g,'&quot;'); }
function escapeHtml(s){ return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); }
function parseDate(s){ if(!s||s===''||s==='nan'||s==='NaT') return null; s=String(s).replace(/-/g,'/').replace(/年/g,'/').replace(/月/g,'/').replace(/日/g,''); var d=new Date(s); return isNaN(d.getTime())?null:d; }
function isoWeek(date){ var d=new Date(date.getTime()); d.setHours(0,0,0,0); d.setDate(d.getDate()+3-((d.getDay()+6)%7)); var w1=new Date(d.getFullYear(),0,4); var w=1+Math.round(((d.getTime()-w1.getTime())/86400000-3+((w1.getDay()+6)%7))/7); return d.getFullYear()+'-W'+(w<10?'0'+w:w); }
function countBy(arr, field){ var m={}; arr.forEach(function(d){ var v=d[field]||'(空)'; m[v]=(m[v]||0)+1; }); return m; }
function toSortedPairs(m, desc){ var arr=Object.keys(m).map(function(k){return [k,m[k]];}); arr.sort(function(a,b){return desc?(b[1]-a[1]):(a[1]-b[1]);}); return arr; }
function statusTag(s){ if(s==='已上架')return '<span class="tag tag-green">'+s+'</span>'; if(s==='运输中')return '<span class="tag tag-orange">'+s+'</span>'; if(s&&s.indexOf('已到仓')===0)return '<span class="tag tag-blue">'+s+'</span>'; return '<span class="tag tag-purple">'+(s||'-')+'</span>'; }
function abnormalTag(s){ return s==='是'?'<span class="tag tag-red">异常</span>':'<span class="tag tag-green">正常</span>'; }

// ============ Tab切换 ============
function switchTab(id, evt){
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
  document.querySelectorAll('.tab-content').forEach(function(t){t.classList.remove('active');});
  var btn = (evt && evt.target) ? evt.target : document.querySelector('.tab[onclick*="'+id+'"]');
  if(btn) btn.classList.add('active');
  document.getElementById(id).classList.add('active');
  // 重resize图表
  setTimeout(function(){ for(var k in allCharts) { if(allCharts[k]) allCharts[k].resize(); } }, 50);
}

// ============ 多选下拉组件工厂 ============
function initMselect(id, key, options, filtersObj, onRender){
  var el = document.getElementById(id);
  var trigger = el.querySelector('.trigger');
  var panel = el.querySelector('.panel');
  var all = document.createElement('div');
  all.className='opt all';
  all.innerHTML = '<input type="checkbox" checked><span>全选</span>';
  panel.appendChild(all);
  options.forEach(function(opt){
    var d=document.createElement('div'); d.className='opt';
    d.innerHTML='<input type="checkbox" checked value="'+escapeAttr(opt)+'"><span>'+escapeHtml(opt)+'</span>';
    panel.appendChild(d);
  });
  trigger.onclick=function(e){ e.stopPropagation(); closeAllMselect(); el.classList.add('open'); };
  panel.onclick=function(e){ e.stopPropagation(); var t=e.target; if(t.tagName==='INPUT'){ handleCheck(e); } };
  function handleCheck(e){
    var boxes=panel.querySelectorAll('.opt:not(.all) input');
    var allBox=all.querySelector('input');
    if(e.target===allBox){ boxes.forEach(function(b){b.checked=allBox.checked;}); }
    else { var ac=true; boxes.forEach(function(b){if(!b.checked)ac=false;}); allBox.checked=ac; }
    updateTrigger();
    var sel=allBox.checked?[]:Array.prototype.map.call(boxes,function(b){return b.checked?b.value:null;}).filter(Boolean);
    filtersObj[key]=sel;
    onRender();
  }
  function updateTrigger(){
    var boxes=panel.querySelectorAll('.opt:not(.all) input');
    var allBox=all.querySelector('input');
    var sel=Array.prototype.map.call(boxes,function(b){return b.checked?b.value:null;}).filter(Boolean);
    if(sel.length===0){trigger.textContent=key+'(无)';trigger.style.color='#dc2626';}
    else if(sel.length===boxes.length){trigger.textContent=key+'(全部)';trigger.style.color='#4c1d95';}
    else if(sel.length<=2){trigger.textContent=key+': '+sel.join(',');trigger.style.color='#4c1d95';}
    else{trigger.textContent=key+'(已选'+sel.length+'项)';trigger.style.color='#4c1d95';}
    filtersObj[key]=allBox.checked?[]:sel;
  }
  updateTrigger();
  return { reset:function(){ panel.querySelectorAll('input[type=checkbox]').forEach(function(b){b.checked=true;}); updateTrigger(); filtersObj[key]=[]; } };
}
function closeAllMselect(){ document.querySelectorAll('.mselect.open').forEach(function(e){e.classList.remove('open');}); }
document.addEventListener('click',function(){closeAllMselect();});

// 图表实例池
var allCharts = {};
function initChart(id){var el=document.getElementById(id);if(!el){console.warn('initChart: element #'+id+' not found, skipped');return null;}try{allCharts[id]=echarts.init(el);return allCharts[id];}catch(e){console.error('initChart #'+id+' failed:',e);return null;}}
window.addEventListener('resize',function(){ for(var k in allCharts){ if(allCharts[k]) allCharts[k].resize(); } });

function openModal(title, html){
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalBody').innerHTML=html;
  document.getElementById('modalOverlay').classList.add('show');
}
function closeModal(){ document.getElementById('modalOverlay').classList.remove('show'); }

// Tab3 单价解析与费用计算（严格对齐原版物流价格看板v2逻辑）
// 计费重/运费/保险费/报关费/总运费 已在build_all.py预处理阶段计算完成，JS直接读取字段
function parsePrice(s){if(!s||s==='')return null;s=String(s).trim();var m=s.match(/^([\d.]+)\s*USD\s*[+/]\s*([\d.]+)\s*RMB$/i);if(m)return Math.round((parseFloat(m[1])*7+parseFloat(m[2]))*100)/100;var parts=s.match(/[\d.]+/g);if(parts)return Math.round(parts.reduce(function(acc,p){return acc+parseFloat(p);},0)*100)/100;return null;}
// 计费重：直接读取预处理字段（九方>渠道计费重>体积重向上取整）
function t3CalcVolWeight(d){return t3Num(d['计费重']);}
// 运费：直接读取预处理字段（单价基础价×计费重，原飞航含燃油）
function t3CalcFee(d){return t3Num(d['运费']);}
// 总运费：直接读取预处理字段（运费+保险费+报关费）
function t3CalcTotalCost(d){return t3Num(d['总金额']);}
// priced定义：单价解析不为空 或 运费>0
function t3IsPriced(d){return parsePrice(d['单价'])!==null||t3Num(d['运费'])>0;}
function t3CalcAvg(d){var vol=t3CalcVolWeight(d),fee=t3CalcFee(d);return vol>0?fee/vol:null;}
function t3StdDev(arr){if(arr.length<2)return 0;var m=arr.reduce(function(a,b){return a+b;},0)/arr.length;var v=arr.reduce(function(a,b){return a+(b-m)*(b-m);},0)/arr.length;return Math.sqrt(v);}
function t3Fmt(n,dec){if(n===null||n===undefined)return '-';if(typeof n!=='number')return n;return n.toLocaleString('zh-CN',{maximumFractionDigits:dec||2,minimumFractionDigits:0});}

// ============================================================
// Tab1: 调拨管理
// ============================================================
var t1Filters = { '物流商':[],'运输类型':[],'收件月份':[],'团队':[],'发货仓库':[],'目的仓库':[],'一级分类':[] };
var t1Mselects = {};
function t1InitFilters(){
  var cfgs = [
    {id:'t1-f-carrier',key:'物流商',opts:uniqueVals(boxData,'物流商')},
    {id:'t1-f-transport',key:'运输类型',opts:uniqueVals(boxData,'运输类型')},
    {id:'t1-f-month',key:'收件月份',opts:uniqueVals(boxData,'收件月份').sort(function(a,b){return a-b;})},
    {id:'t1-f-team',key:'团队',opts:uniqueVals(boxData,'团队')},
    {id:'t1-f-wh',key:'发货仓库',opts:uniqueVals(boxData,'发货仓库')},
    {id:'t1-f-dest',key:'目的仓库',opts:uniqueVals(boxData,'目的仓库')},
    {id:'t1-f-cat',key:'一级分类',opts:uniqueVals(boxData,'一级分类')}
  ];
  cfgs.forEach(function(c){ t1Mselects[c.key]=initMselect(c.id,c.key,c.opts,t1Filters,t1Render); });
}
function t1Reset(){ for(var k in t1Mselects){t1Mselects[k].reset();} t1Render(); }
function t1FilterBox(d){ for(var k in t1Filters){ if(t1Filters[k].length&&t1Filters[k].indexOf(String(d[k]))===-1) return false; } return true; }

var T1_CHART_IDS=['t1-c-transport','t1-c-carrier','t1-c-month','t1-c-week','t1-c-exception','t1-c-carrier-exc','t1-c-wh','t1-c-dest','t1-c-team','t1-c-status'];
function t1InitCharts(){T1_CHART_IDS.forEach(initChart);}

function t1Render(){
  var data = boxData.filter(t1FilterBox);
  // KPI
  var total=data.length, totalQty=data.reduce(function(s,d){var n=Number(d['计划数量']);return s+(isNaN(n)?0:n);},0);
  var onShelf=data.filter(function(d){return d['物流状态']==='已上架';}).length;
  var arrived=data.filter(function(d){return d['物流状态']==='已到仓（亚马逊/FBT）';}).length;
  var inTransit=data.filter(function(d){return d['物流状态']==='运输中';}).length;
  var abnormal=data.filter(function(d){return d['是否异常']==='是';}).length;
  var ar=total?(abnormal/total*100).toFixed(1):0;
  document.getElementById('t1-kpiRow').innerHTML=[
    {l:'总调拨箱数',v:total,s:'当前筛选',c:'ok'},
    {l:'总调拨件数',v:Math.round(totalQty),s:'计划数量求和',c:'ok'},
    {l:'已上架',v:onShelf,s:total?('占比'+(onShelf/total*100).toFixed(1)+'%'):'-',c:'ok'},
    {l:'已到仓',v:arrived,s:total?('占比'+(arrived/total*100).toFixed(1)+'%'):'-',c:'ok'},
    {l:'运输中',v:inTransit,s:total?('占比'+(inTransit/total*100).toFixed(1)+'%'):'-',c:'ok'},
    {l:'异常箱数',v:abnormal,s:'异常率'+ar+'%',c:ar>20?'up':'ok'}
  ].map(function(c){return '<div class="kpi"><div class="k-label">'+c.l+'</div><div class="k-value">'+c.v.toLocaleString()+'</div><div class="k-sub"><span class="'+c.c+'">'+c.s+'</span></div></div>';}).join('');
  document.getElementById('t1-filterCount').textContent='当前筛选: '+data.length+' / '+boxData.length+' 箱';
  // 图表
  var m=countBy(data,'运输类型');
  allCharts['t1-c-transport'].setOption({tooltip:{trigger:'item',formatter:'{b}: {c}箱 ({d}%)'},legend:{bottom:0,textStyle:{fontSize:12,color:'#6b7280'}},color:PALETTE,series:[{type:'pie',radius:['40%','68%'],center:['50%','45%'],itemStyle:{borderColor:'#fff',borderWidth:2},label:{formatter:'{b}\n{c}箱',color:'#4c1d95',fontSize:12},data:Object.keys(m).map(function(k){return {name:k,value:m[k]};})}]});
  var ca=toSortedPairs(countBy(data,'物流商'),true);
  allCharts['t1-c-carrier'].setOption({tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},grid:{left:10,right:20,top:10,bottom:60,containLabel:true},xAxis:{type:'category',data:ca.map(function(a){return a[0];}),axisLabel:{rotate:35,color:'#6b7280',fontSize:11}},yAxis:{type:'value',axisLabel:{color:'#9ca3af'}},series:[{type:'bar',data:ca.map(function(a){return a[1];}),itemStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#8b5cf6'},{offset:1,color:'#c4b5fd'}]),borderRadius:[4,4,0,0]},barMaxWidth:36}]});
  var mm={};data.forEach(function(d){var y=d['收件年份'],mo=d['收件月份'];if(y&&mo){var k=y+'-'+mo;m[k]=(mm[k]=(mm[k]||0)+1);}});var ma=Object.keys(mm).sort();
  allCharts['t1-c-month'].setOption({tooltip:{trigger:'axis'},grid:{left:10,right:20,top:20,bottom:30,containLabel:true},xAxis:{type:'category',data:ma.map(function(k){return k.replace(/^\d+-/,'第')+'月';}),axisLabel:{color:'#6b7280'}},yAxis:{type:'value',axisLabel:{color:'#9ca3af'}},series:[{type:'line',data:ma.map(function(k){return mm[k];}),smooth:true,symbol:'circle',symbolSize:8,lineStyle:{width:3,color:'#7c3aed'},itemStyle:{color:'#7c3aed'},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(124,58,237,.35)'},{offset:1,color:'rgba(124,58,237,.02)'}])}}]});
  var wm={};data.forEach(function(d){var dt=parseDate(d['提货时间']);if(dt){var w=isoWeek(dt);if(w)wm[w]=(wm[w]||0)+1;}});var wa=Object.keys(wm).sort();
  allCharts['t1-c-week'].setOption({tooltip:{trigger:'axis'},grid:{left:10,right:20,top:20,bottom:60,containLabel:true},xAxis:{type:'category',data:wa,axisLabel:{rotate:35,color:'#6b7280',fontSize:10}},yAxis:{type:'value',axisLabel:{color:'#9ca3af'}},dataZoom:[{type:'inside'},{type:'slider',height:16,bottom:10}],series:[{type:'line',data:wa.map(function(k){return wm[k];}),smooth:true,symbol:'circle',symbolSize:6,lineStyle:{width:2,color:'#8b5cf6'},itemStyle:{color:'#8b5cf6'},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(139,92,246,.3)'},{offset:1,color:'rgba(139,92,246,.02)'}])}}]});
  var la=countBy(data,'物流异常'),sa=countBy(data,'上架异常'),ea=[];
  Object.keys(la).forEach(function(k){if(k&&k!=='无异常'&&k!=='')ea.push({name:'物流:'+k,value:la[k]});});
  Object.keys(sa).forEach(function(k){if(k&&k!=='无异常'&&k!=='')ea.push({name:'上架:'+k,value:sa[k]});});
  ea.sort(function(a,b){return b.value-a.value;});
  allCharts['t1-c-exception'].setOption({tooltip:{trigger:'item',formatter:'{b}: {c}箱 ({d}%)'},legend:{type:'scroll',bottom:0,textStyle:{fontSize:11,color:'#6b7280'}},color:PALETTE,series:[{type:'pie',radius:['35%','65%'],center:['50%','45%'],itemStyle:{borderColor:'#fff',borderWidth:2},label:{formatter:'{b}\n{c}箱',fontSize:11,color:'#4c1d95'},data:ea}]});
  var tt={},ab={};data.forEach(function(d){tt[d['物流商']]=(tt[d['物流商']]||0)+1;if(d['是否异常']==='是')ab[d['物流商']]=(ab[d['物流商']]||0)+1;});
  var cs=Object.keys(tt).sort(function(a,b){return tt[b]-tt[a];}).slice(0,12);var rs=cs.map(function(c){return tt[c]?+((ab[c]||0)/tt[c]*100).toFixed(1):0;});
  allCharts['t1-c-carrier-exc'].setOption({tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(p){return p[0].name+': '+p[0].value+'%';}},grid:{left:10,right:20,top:20,bottom:60,containLabel:true},xAxis:{type:'category',data:cs,axisLabel:{rotate:35,color:'#6b7280',fontSize:11}},yAxis:{type:'value',name:'异常率%',axisLabel:{color:'#9ca3af',formatter:'{value}%'}},series:[{type:'bar',data:rs,itemStyle:{color:function(p){return rs[p.dataIndex]>30?'#dc2626':(rs[p.dataIndex]>15?'#c2410c':'#7c3aed');},borderRadius:[4,4,0,0]},barMaxWidth:36,label:{show:true,position:'top',formatter:'{c}%',color:'#6b7280',fontSize:10}}]});
  var wh=toSortedPairs(countBy(data,'发货仓库'),true);
  allCharts['t1-c-wh'].setOption({tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},grid:{left:10,right:20,top:10,bottom:30,containLabel:true},xAxis:{type:'category',data:wh.map(function(a){return a[0];}),axisLabel:{color:'#6b7280'}},yAxis:{type:'value',axisLabel:{color:'#9ca3af'}},series:[{type:'bar',data:wh.map(function(a){return a[1];}),itemStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#7c3aed'},{offset:1,color:'#a78bfa'}]),borderRadius:[4,4,0,0]},barMaxWidth:50}]});
  var de=toSortedPairs(countBy(data,'目的仓库'),true).slice(0,10).reverse();
  allCharts['t1-c-dest'].setOption({tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},grid:{left:10,right:20,top:10,bottom:20,containLabel:true},xAxis:{type:'value',axisLabel:{color:'#9ca3af'}},yAxis:{type:'category',data:de.map(function(a){return a[0];}),axisLabel:{color:'#6b7280'}},series:[{type:'bar',data:de.map(function(a){return a[1];}),itemStyle:{color:new echarts.graphic.LinearGradient(1,0,0,0,[{offset:0,color:'#8b5cf6'},{offset:1,color:'#c4b5fd'}]),borderRadius:[0,4,4,0]},barMaxWidth:22,label:{show:true,position:'right',color:'#6b7280',fontSize:11}}]});
  var tm=toSortedPairs(countBy(data,'团队'),true);
  allCharts['t1-c-team'].setOption({tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},grid:{left:10,right:20,top:10,bottom:60,containLabel:true},xAxis:{type:'category',data:tm.map(function(a){return a[0];}),axisLabel:{rotate:25,color:'#6b7280',fontSize:11}},yAxis:{type:'value',axisLabel:{color:'#9ca3af'}},series:[{type:'bar',data:tm.map(function(a){return a[1];}),itemStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#7c3aed'},{offset:1,color:'#c4b5fd'}]),borderRadius:[4,4,0,0]},barMaxWidth:40}]});
  var st=toSortedPairs(countBy(data,'物流状态'),true);
  allCharts['t1-c-status'].setOption({tooltip:{trigger:'item',formatter:'{b}: {c}箱 ({d}%)'},legend:{bottom:0,textStyle:{fontSize:12,color:'#6b7280'}},color:['#7c3aed','#a78bfa','#c4b5fd','#ddd6fe','#8b5cf6'],series:[{type:'pie',radius:['40%','68%'],center:['50%','45%'],itemStyle:{borderColor:'#fff',borderWidth:2},label:{formatter:'{b}\n{c}箱',color:'#4c1d95',fontSize:12},data:st.map(function(a){return {name:a[0],value:a[1]};})}]});
  t1RenderDetail();
}
// Tab1 单号查询（按入库单号聚合，点击展开面板）
var t1OrderIdx = 0; // 生成唯一ID计数
// 取对象中值最大的 key（物流商/运输类型/时效要求等众数）
function t1TopKey(obj){var keys=Object.keys(obj);keys.sort(function(a,b){return obj[b]-obj[a];});return keys[0]||'-';}
function t1DoLookup(){
  var q=document.getElementById('t1-lookupInput').value.trim();var box=document.getElementById('t1-lookupResult');
  if(!q){box.innerHTML='<div class="empty">请输入单号</div>';return;}
  var tokens=q.split(/[\s,，]+/).filter(function(k){return k;});
  var matched=boxData.filter(function(d){
    var inNo=String(d['入库单号']),bxNo=String(d['箱号']),dbNo=String(d['调拨单号']);
    for(var i=0;i<tokens.length;i++){var t=tokens[i];if(inNo===t||bxNo===t||dbNo===t||bxNo.replace(/\s/g,'')===t.replace(/\s/g,''))return true;}
    return false;
  });
  if(matched.length===0){box.innerHTML='<div class="empty">未找到单号: '+escapeHtml(q)+'</div>';return;}
  // 按入库单号聚合去重箱
  var orderMap={};
  matched.forEach(function(d){
    var inNo=d['入库单号'];
    if(!orderMap[inNo])orderMap[inNo]={inNo:inNo,dbNo:d['调拨单号'],boxes:[]};
    var key=d['箱号'];
    for(var i=0;i<orderMap[inNo].boxes.length;i++){if(orderMap[inNo].boxes[i]['箱号']===key)return;}
    orderMap[inNo].boxes.push(d);
  });
  var orders=Object.keys(orderMap).map(function(k){return orderMap[k];});
  // 汇总统计
  var totalBoxes=0,totalPieces=0;
  orders.forEach(function(o){totalBoxes+=o.boxes.length;o.boxes.forEach(function(b){totalPieces+=parseFloat(b['计划数量'])||0;});});
  var html='<div style="font-size:13px;color:#6b7280;margin-bottom:10px">找到 '+orders.length+' 个订单 · 共 '+totalBoxes+' 箱 · '+Math.round(totalPieces)+' 件（点击订单行展开箱明细）</div>';
  orders.forEach(function(o,oi){
    var bs=o.boxes;
    // 取最常见的值作为订单摘要
    var carriers={},transports={},periods={},statuses={},totalQ=0;
    bs.forEach(function(b){
      carriers[b['物流商']]=(carriers[b['物流商']]||0)+1;
      transports[b['运输类型']]=(transports[b['运输类型']]||0)+1;
      periods[b['时效要求']]=(periods[b['时效要求']]||0)+1;
      statuses[b['物流状态']]=(statuses[b['物流状态']]||0)+1;
      totalQ+=parseFloat(b['计划数量'])||0;
    });
    var topCarrier=t1TopKey(carriers),topTrans=t1TopKey(transports),topPeriod=t1TopKey(periods),topStatus=t1TopKey(statuses);
    // 扫描订单内所有箱的异常情况，按件数统计
    var excQty=0,chkQty=0;
    bs.forEach(function(b){var q=qtyOf(b);if(isExc(b))excQty+=q;if(isChk(b))chkQty+=q;});
    var hintHtml='';
    if(excQty>0)hintHtml+='<span class="tag tag-red" title="超时异常（按件数）" style="margin-left:6px">超时·'+excQty+'件</span>';
    if(chkQty>0)hintHtml+='<span class="tag tag-orange" title="查验异常（按件数）" style="margin-left:4px">查验·'+chkQty+'件</span>';
    var gid='t1-og-'+(++t1OrderIdx);
    // 默认第1个展开
    var expanded=oi===0?' expanded':'';
    html+='<div class="order-group'+expanded+'" id="'+gid+'" data-order-index="'+oi+'">';
    html+='  <div class="order-header" onclick="t1ToggleOrder(\''+gid+'\')">';
    html+='    <div class="order-arrow">▶</div>';
    html+='    <div class="order-sum">';
    html+='      <div class="o-field"><span class="lab">入库单号</span><span class="val primary">'+escapeHtml(o.inNo)+'</span></div>';
    html+='      <div class="o-field"><span class="lab">调拨单号</span><span class="val">'+escapeHtml(o.dbNo||'-')+'</span></div>';
    html+='      <div class="o-field"><span class="lab">箱数 × 件数</span><span class="val">'+bs.length+' 箱 × '+Math.round(totalQ)+' 件</span></div>';
    html+='      <div class="o-field"><span class="lab">物流商</span><span class="val">'+escapeHtml(topCarrier)+'</span></div>';
    html+='      <div class="o-field"><span class="lab">运输类型</span><span class="val">'+escapeHtml(topTrans)+'</span></div>';
    html+='      <div class="o-field"><span class="lab">时效要求</span><span class="val" style="color:#7c3aed;font-weight:600">'+escapeHtml(topPeriod)+'</span></div>';
    html+='      <div class="o-field" style="margin-left:auto"><span class="lab">整体状态</span><span class="val">'+statusTag(topStatus)+hintHtml+'</span></div>';
    html+='    </div>';
    html+='  </div>';
    html+='  <div class="order-body">';
    // 箱列表
    var bxHtml='<div style="font-size:12px;color:#6b7280;margin:10px 0 6px">点击箱卡片查看时间轴</div><div class="box-list">';
    bs.forEach(function(b,i){bxHtml+='<div class="box-item'+(i===0?' active':'')+'" onclick="t1ShowTimeline(\''+gid+'\',\''+escapeAttr(o.inNo)+'\',\''+escapeAttr(b['箱号'])+'\','+i+')"><div class="bi-head"><span class="bi-no">箱号: '+escapeHtml(b['箱号'])+'</span><span class="bi-meta">时效要求: <b style="color:#7c3aed">'+escapeHtml(b['时效要求']||'-')+'</b></span><span class="bi-meta">物流商: '+escapeHtml(b['物流商']||'-')+'</span><span class="bi-meta">运输: '+escapeHtml(b['运输类型']||'-')+'</span><span class="bi-meta">'+statusTag(b['物流状态'])+'</span></div></div>';});
    bxHtml+='</div>';
    html+=bxHtml;
    // Timeline占位
    html+='    <div id="'+gid+'-timeline"></div>';
    html+='  </div>';
    html+='</div>';
  });
  box.innerHTML=html;
  // 默认展开第一个并展示第一箱
  if(orders.length>0){
    var firstGid='t1-og-'+(t1OrderIdx-orders.length+1);
    t1ShowTimeline(firstGid,orders[0].inNo,orders[0].boxes[0]['箱号'],0);
  }
}
// 切换订单行展开/折叠（状态存 dataset）
function t1ToggleOrder(gid){
  var grp=document.getElementById(gid);if(!grp)return;
  grp.classList.toggle('expanded');
}
// 点击箱卡片显示时间轴（限定在当前 order-group 范围内，避免状态串台）
function t1ShowTimeline(gid,inNo,boxNo,boxIdx){
  var grp=document.getElementById(gid);if(!grp)return;
  var groupIdx=grp.getAttribute('data-order-index');
  // 仅当前组内高亮，不影响其他组
  var boxList=grp.querySelector('.box-list');
  if(boxList){
    boxList.querySelectorAll('.box-item').forEach(function(el,i){el.classList.toggle('active',i===boxIdx);});
  }
  var tm=getBoxTime(inNo,boxNo)||{};
  var area=document.getElementById(gid+'-timeline');if(!area)return;
  var nodes=[{label:'提货',icon:'提',actual:tm['提货'],expected:''},{label:'起飞',icon:'飞',actual:tm['离港'],expected:''},{label:'落地',icon:'落',actual:tm['到港'],expected:''},{label:'签收',icon:'收',actual:tm['签收'],expected:tm['预计签收']},{label:'上架',icon:'架',actual:tm['上架'],expected:tm['预计上架']}];
  var html='<div class="time-axis">';
  nodes.forEach(function(n){var isDone=n.actual&&n.actual!==''&&n.actual!=='nan'&&n.actual!=='NaT';html+='<div class="ta-node '+(isDone?'done':'empty')+'"><div class="ta-line"></div><div class="ta-dot">'+n.icon+'</div><div class="ta-label">'+n.label+'</div>'+(isDone?'<div class="ta-time actual">'+fmtT(n.actual)+'</div>':'<div class="ta-time">'+(n.expected&&n.expected!==''&&n.expected!=='nan'?'预计: '+fmtT(n.expected):'未完成')+'</div>')+'</div>';});
  html+='</div><div class="info-grid"><div class="item"><div class="lab">物流状态</div><div class="val">'+statusTag(tm['物流状态'])+'</div></div><div class="item"><div class="lab">物流商</div><div class="val">'+escapeHtml(tm['物流商']||'-')+'</div></div><div class="item"><div class="lab">运输类型</div><div class="val">'+escapeHtml(tm['运输类型']||'-')+'</div></div><div class="item"><div class="lab">时效要求</div><div class="val" style="color:#7c3aed;font-weight:600">'+escapeHtml(tm['时效要求']||'-')+'</div></div><div class="item"><div class="lab">团队</div><div class="val">'+escapeHtml(tm['团队']||'-')+'</div></div><div class="item"><div class="lab">发货仓库</div><div class="val">'+escapeHtml(tm['发货仓库']||'-')+'</div></div><div class="item"><div class="lab">目的仓库</div><div class="val">'+escapeHtml(tm['目的仓库']||'-')+'</div></div><div class="item"><div class="lab">箱号</div><div class="val">'+escapeHtml(boxNo)+'</div></div></div>';
  area.innerHTML=html;
}
// Tab1 SKU明细表
var t1DetailState={page:1,pageSize:50,search:'',status:'',abnormal:'',sortField:'入库单号',sortDir:'asc'};
function t1OnSearch(){t1DetailState.search=document.getElementById('t1-searchInput').value;t1DetailState.status=document.getElementById('t1-searchStatus').value;t1DetailState.abnormal=document.getElementById('t1-searchAbnormal').value;t1DetailState.page=1;t1RenderDetail();}
function t1SortBy(f){if(t1DetailState.sortField===f){t1DetailState.sortDir=t1DetailState.sortDir==='asc'?'desc':'asc';}else{t1DetailState.sortField=f;t1DetailState.sortDir='asc';}t1RenderDetail();}
function t1GoPage(p){t1DetailState.page=p;t1RenderDetail();}
function t1RenderDetail(){
  var s=t1DetailState.search.toLowerCase().trim();var kws=s?s.split(/[\s,，]+/).filter(function(k){return k;}):[];
  var filtered=skuData.filter(function(d){
    if(t1DetailState.status&&d['物流状态']!==t1DetailState.status)return false;
    if(t1DetailState.abnormal&&d['是否异常']!==t1DetailState.abnormal)return false;
    if(kws.length){var hay=(d['入库单号']+' '+d['赫特SKU']+' '+d['第三方SKU']+' '+d['产品名称']+' '+d['运单号']).toLowerCase();var m=false;for(var i=0;i<kws.length;i++){if(hay.indexOf(kws[i])>-1){m=true;break;}}if(!m)return false;}
    return true;
  });
  var sf=t1DetailState.sortField,dir=t1DetailState.sortDir==='asc'?1:-1;
  filtered.sort(function(a,b){var x=a[sf],y=b[sf];if(typeof x==='number'&&typeof y==='number')return(x-y)*dir;return String(x).localeCompare(String(y))*dir;});
  var sel=document.getElementById('t1-searchStatus');
  if(sel.options.length<=1){uniqueVals(skuData,'物流状态').forEach(function(st){var o=document.createElement('option');o.value=st;o.textContent=st;sel.appendChild(o);});}
  var colLabels={'入库单号':'第三方入库单号','提货时间':'提货','预计签收':'预计签收','预计上架':'预计上架','实际签收':'实际签收','实际上架':'实际上架'};
  var cols=['入库单号','箱号','赫特SKU','产品名称','计划数量','上架数量','未上架数量','发货仓','目的仓','团队','物流状态','是否异常','提货时间','预计签收','预计上架','实际签收','实际上架','运单号'];
  document.querySelector('#t1-detailTable thead').innerHTML='<tr>'+cols.map(function(c){var ar=t1DetailState.sortField===c?(t1DetailState.sortDir==='asc'?'▲':'▼'):'';return '<th onclick="t1SortBy(\''+c+'\')">'+(colLabels[c]||c)+'<span class="arrow">'+ar+'</span></th>';}).join('')+'</tr>';
  var total=filtered.length,pages=Math.ceil(total/t1DetailState.pageSize)||1;if(t1DetailState.page>pages)t1DetailState.page=1;
  var start=(t1DetailState.page-1)*t1DetailState.pageSize,pd=filtered.slice(start,start+t1DetailState.pageSize);
  document.querySelector('#t1-detailTable tbody').innerHTML=pd.map(function(d){var tm=getBoxTime(d['入库单号'],d['箱号'])||{};return '<tr><td>'+escapeHtml(d['入库单号']||'')+'</td><td>'+escapeHtml(d['箱号']||'')+'</td><td>'+escapeHtml(d['赫特SKU']||'')+'</td><td>'+escapeHtml(d['产品名称']||'')+'</td><td>'+escapeHtml(d['计划数量']??'')+'</td><td>'+escapeHtml(d['上架数量']??'')+'</td><td>'+(d['未上架数量']?'<span style="color:#dc2626">'+d['未上架数量']+'</span>':'0')+'</td><td>'+escapeHtml(d['发货仓']||'')+'</td><td>'+escapeHtml(d['目的仓']||'')+'</td><td>'+escapeHtml(d['团队']||'')+'</td><td>'+statusTag(d['物流状态'])+'</td><td>'+abnormalTag(d['是否异常'])+'</td><td>'+fmtT(d['提货时间'])+'</td><td>'+fmtT(tm['预计签收'])+'</td><td>'+fmtT(tm['预计上架'])+'</td><td>'+fmtT(tm['签收'])+'</td><td>'+fmtT(tm['上架'])+'</td><td>'+escapeHtml(d['运单号']||'')+'</td></tr>';}).join('')||'<tr><td colspan="18" class="empty">无匹配数据</td></tr>';
  document.getElementById('t1-detailCount').textContent='共 '+total.toLocaleString()+' 条';
  document.getElementById('t1-pager').innerHTML='<button onclick="t1GoPage(1)" '+(t1DetailState.page<=1?'disabled':'')+'>首页</button><button onclick="t1GoPage('+(t1DetailState.page-1)+')" '+(t1DetailState.page<=1?'disabled':'')+'>上一页</button><span class="info">第 '+t1DetailState.page+' / '+pages+' 页</span><button onclick="t1GoPage('+(t1DetailState.page+1)+')" '+(t1DetailState.page>=pages?'disabled':'')+'>下一页</button><button onclick="t1GoPage('+pages+')" '+(t1DetailState.page>=pages?'disabled':'')+'>末页</button><span class="info">每页 '+t1DetailState.pageSize+' 条</span>';
}
function t1ExportDetail(){
  var s=t1DetailState.search.toLowerCase().trim();var kws=s?s.split(/[\s,，]+/).filter(function(k){return k;}):[];
  var filtered=skuData.filter(function(d){if(t1DetailState.status&&d['物流状态']!==t1DetailState.status)return false;if(t1DetailState.abnormal&&d['是否异常']!==t1DetailState.abnormal)return false;if(kws.length){var hay=(d['入库单号']+' '+d['赫特SKU']+' '+d['产品名称']+' '+d['运单号']).toLowerCase();var m=false;for(var i=0;i<kws.length;i++){if(hay.indexOf(kws[i])>-1){m=true;break;}}if(!m)return false;}return true;});
  var cols=['入库单号','箱号','赫特SKU','产品名称','计划数量','上架数量','未上架数量','发货仓','目的仓','团队','物流状态','是否异常','运单号'];
  var csv='\uFEFF'+cols.join(',')+'\n';
  filtered.forEach(function(d){csv+=cols.map(function(c){return '"'+String(d[c]||'').replace(/"/g,'""')+'"';}).join(',')+'\n';});
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='SKU明细_'+new Date().toLocaleDateString().replace(/\//g,'')+'.csv';a.click();
}

// ============================================================
// Tab2: 物流商异常时效
// ============================================================
var t2Filters = { '仓库类型':[],'运输类型':[],'团队':[],'目的仓':[],'时效要求':[],'一级分类':[],startDate:'',endDate:'' };
var t2Mselects = {};
var t2Source = 'total';
function t2InitFilters(){
  var cfgs = [
    {id:'t2-f-whtype',key:'仓库类型',opts:uniqueVals(t2BoxData,'仓库类型')},
    {id:'t2-f-transport',key:'运输类型',opts:uniqueVals(t2BoxData,'运输类型')},
    {id:'t2-f-team',key:'团队',opts:uniqueVals(t2BoxData,'团队')},
    {id:'t2-f-dest',key:'目的仓',opts:uniqueVals(t2BoxData,'目的仓库')},
    {id:'t2-f-period',key:'时效要求',opts:uniqueVals(t2BoxData,'时效要求')},
    {id:'t2-f-cat',key:'一级分类',opts:uniqueVals(t2BoxData,'一级分类')}
  ];
  cfgs.forEach(function(c){ t2Mselects[c.key]=initMselect(c.id,c.key,c.opts,t2Filters,t2Render); });
}
function t2SwitchSource(src, evt){ t2Source=src; document.querySelectorAll('#t2-filters .src-tab').forEach(function(t){t.classList.remove('active');}); var btn=(evt&&evt.target)?evt.target:document.querySelector('#t2-filters .src-tab[onclick*="'+src+'"]'); if(btn)btn.classList.add('active'); t2Render(); }
function t2Reset(){ for(var k in t2Mselects){t2Mselects[k].reset();} t2Filters.startDate='';t2Filters.endDate='';document.getElementById('t2-startDate').value='';document.getElementById('t2-endDate').value='';t2Render(); }
function t2QuickDate(type){ var now=new Date(),s,e; if(type==='7d'){s=new Date(now.getTime()-7*86400000);e=now;} else if(type==='30d'){s=new Date(now.getTime()-30*86400000);e=now;} else if(type==='thisMonth'){s=new Date(now.getFullYear(),now.getMonth(),1);e=now;} else if(type==='lastMonth'){s=new Date(now.getFullYear(),now.getMonth()-1,1);e=new Date(now.getFullYear(),now.getMonth(),0);} var f=function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}; t2Filters.startDate=f(s);t2Filters.endDate=f(e);document.getElementById('t2-startDate').value=t2Filters.startDate;document.getElementById('t2-endDate').value=t2Filters.endDate;t2Render(); }
function t2ClearDate(){ t2Filters.startDate='';t2Filters.endDate='';document.getElementById('t2-startDate').value='';document.getElementById('t2-endDate').value='';t2Render(); }
function t2FilterBox(d){
  if(t2Source==='domestic'&&String(d['发货仓库']).trim()==='168')return false;
  if(t2Source==='bangladesh'&&String(d['发货仓库']).trim()!=='168')return false;
  if(t2Filters['仓库类型'].length&&t2Filters['仓库类型'].indexOf(String(d['仓库类型']))===-1)return false;
  if(t2Filters['运输类型'].length&&t2Filters['运输类型'].indexOf(String(d['运输类型']))===-1)return false;
  if(t2Filters['团队'].length&&t2Filters['团队'].indexOf(String(d['团队']))===-1)return false;
  if(t2Filters['目的仓'].length&&t2Filters['目的仓'].indexOf(String(d['目的仓库']))===-1)return false;
  if(t2Filters['时效要求'].length&&t2Filters['时效要求'].indexOf(String(d['时效要求']))===-1)return false;
  if(t2Filters['一级分类'].length&&t2Filters['一级分类'].indexOf(String(d['一级分类']))===-1)return false;
  if(t2Filters.startDate||t2Filters.endDate){ var dt=parseDate(d['提货时间']); if(!dt)return false; if(t2Filters.startDate){var s=new Date(t2Filters.startDate+'T00:00:00');if(dt<s)return false;} if(t2Filters.endDate){var e=new Date(t2Filters.endDate+'T23:59:59');if(dt>e)return false;} }
  return true;
}
var T2_CHART_IDS=['t2-c-period','t2-c-transport','t2-c-compliance','t2-c-error'];
function t2InitCharts(){T2_CHART_IDS.forEach(initChart);}
var t2DetailState={page:1,pageSize:20,search:''};
function t2Render(){
  var data=t2BoxData.filter(t2FilterBox);
  var total=data.length, totalQty=data.reduce(function(s,d){return s+qtyOf(d);},0);
  var orders={};data.forEach(function(d){orders[d['入库单号']]=1;});
  var totalOrders=Object.keys(orders).length;
  var validData=data.filter(isValidStat);
  var validQty=validData.reduce(function(s,d){return s+qtyOf(d);},0);
  var excQty=validData.filter(isExc).reduce(function(s,d){return s+qtyOf(d);},0);
  var chkQty=data.filter(isChk).reduce(function(s,d){return s+qtyOf(d);},0);
  var excRate=validQty?(excQty/validQty*100).toFixed(2):0;
  var chkRate=totalQty?(chkQty/totalQty*100).toFixed(2):0;
  var compRate=validQty?((validQty-excQty)/validQty*100).toFixed(2):0;
  document.getElementById('t2-kpiRow').innerHTML=[
    {l:'时效达标率',v:compRate+'%',s:'达标 '+Math.round(validQty-excQty)+' / '+Math.round(validQty)+' 件(有效统计)',c:compRate>=80?'ok':'up',clk:''},
    {l:'超时异常率',v:excRate+'%',s:'异常 '+Math.round(excQty)+' 件 · 点击查看 →',c:excRate>20?'up':'ok',clk:' onclick="t2ShowAnomalyOrders(\'超时异常\')" style="cursor:pointer"'},
    {l:'查验异常率',v:chkRate+'%',s:'查验 '+Math.round(chkQty)+' 件 · 点击查看 →',c:chkRate>10?'up':'ok',clk:' onclick="t2ShowAnomalyOrders(\'查验异常\')" style="cursor:pointer"'},
    {l:'总件数',v:Math.round(totalQty).toLocaleString(),s:'计划数量求和',c:'ok',clk:''},
    {l:'总订单数',v:totalOrders.toLocaleString(),s:'入库单号去重',c:'ok',clk:''}
  ].map(function(c){return '<div class="kpi"'+c.clk+'><div class="k-label">'+c.l+'</div><div class="k-value">'+c.v+'</div><div class="k-sub"><span class="'+c.c+'">'+c.s+'</span></div></div>';}).join('');
  document.getElementById('t2-filterCount').textContent='当前筛选: '+data.length+' / '+t2BoxData.length+' 箱 (有效统计 '+validData.length+' 箱 / '+Math.round(validQty)+' 件)';
  // 图表1: 时效要求分布(按件数)
  var pm={};data.forEach(function(d){var k=d['时效要求']||'(空)';pm[k]=(pm[k]||0)+qtyOf(d);});
  t3SetOption('t2-c-period',{tooltip:{trigger:'item',formatter:'{b}: {c}件 ({d}%)'},legend:{bottom:0,textStyle:{fontSize:12,color:'#6b7280'}},color:PALETTE,series:[{type:'pie',radius:['40%','68%'],center:['50%','45%'],itemStyle:{borderColor:'#fff',borderWidth:2},label:{formatter:'{b}\n{c}件',color:'#4c1d95',fontSize:12},data:Object.keys(pm).map(function(k){return {name:k,value:pm[k]};})}]});
  // 图表2: 运输类型分布(按件数)
  var tm={};data.forEach(function(d){var k=d['运输类型']||'(空)';tm[k]=(tm[k]||0)+qtyOf(d);});
  t3SetOption('t2-c-transport',{tooltip:{trigger:'item',formatter:'{b}: {c}件 ({d}%)'},legend:{bottom:0,textStyle:{fontSize:12,color:'#6b7280'}},color:PALETTE,series:[{type:'pie',radius:['40%','68%'],center:['50%','45%'],itemStyle:{borderColor:'#fff',borderWidth:2},label:{formatter:'{b}\n{c}件',color:'#4c1d95',fontSize:12},data:Object.keys(tm).map(function(k){return {name:k,value:tm[k]};})}]});
  // 图表3: 物流商达标率排名(按件数)
  var stats={};data.forEach(function(d){var c=d['物流商'];if(!stats[c])stats[c]={total:0,valid:0,exc:0,chk:0,qty:0,validQty:0,excQty:0,chkQty:0};stats[c].total++;stats[c].qty+=qtyOf(d);if(isValidStat(d)){stats[c].valid++;stats[c].validQty+=qtyOf(d);if(isExc(d))stats[c].excQty+=qtyOf(d);}if(isChk(d))stats[c].chkQty+=qtyOf(d);});
  var carriers=Object.keys(stats).filter(function(c){return stats[c].total>=1;}).sort(function(a,b){return stats[b].qty-stats[a].qty;}).slice(0,15);
  var compRates=carriers.map(function(c){return stats[c].validQty?+((stats[c].validQty-stats[c].excQty)/stats[c].validQty*100).toFixed(2):0;});
  t3SetOption('t2-c-compliance',{tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(p){var s=stats[carriers[p[0].dataIndex]];return p[0].name+'<br/>达标率: '+p[0].value+'%<br/>有效统计: '+Math.round(s.validQty)+' 件 / '+s.total+' 箱';}},grid:{left:10,right:20,top:20,bottom:60,containLabel:true},xAxis:{type:'category',data:carriers,axisLabel:{rotate:35,color:'#6b7280',fontSize:11}},yAxis:{type:'value',name:'达标率%',max:100,axisLabel:{color:'#9ca3af',formatter:'{value}%'}},series:[{type:'bar',data:compRates,itemStyle:{color:function(p){return compRates[p.dataIndex]>=80?'#7c3aed':(compRates[p.dataIndex]>=60?'#c2410c':'#dc2626');},borderRadius:[4,4,0,0]},barMaxWidth:36,label:{show:true,position:'top',formatter:'{c}%',color:'#6b7280',fontSize:10}}]});
  // 图表4: 物流商异常率对比(按件数)
  var excRates=carriers.map(function(c){return stats[c].validQty?+(stats[c].excQty/stats[c].validQty*100).toFixed(2):0;});
  t3SetOption('t2-c-error',{tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(p){var s=stats[carriers[p[0].dataIndex]];return p[0].name+'<br/>超时率: '+p[0].value+'%<br/>查验率: '+(s.qty?(s.chkQty/s.qty*100).toFixed(2):0)+'%';}},grid:{left:10,right:20,top:30,bottom:60,containLabel:true},xAxis:{type:'category',data:carriers,axisLabel:{rotate:35,color:'#6b7280',fontSize:11}},yAxis:{type:'value',name:'异常率%',axisLabel:{color:'#9ca3af',formatter:'{value}%'}},series:[{name:'超时率',type:'bar',data:excRates,itemStyle:{color:function(p){return excRates[p.dataIndex]>30?'#dc2626':(excRates[p.dataIndex]>15?'#c2410c':'#7c3aed');},borderRadius:[4,4,0,0]},barMaxWidth:36,label:{show:true,position:'top',formatter:'{c}%',color:'#6b7280',fontSize:10}}]});
  t2RenderTable();
  t2RenderMonthlyCross();
}
function t2RenderTable(){
  var data=t2BoxData.filter(t2FilterBox);
  var stats={};data.forEach(function(d){var c=d['物流商'];if(!stats[c])stats[c]={total:0,valid:0,qty:0,validQty:0,excQty:0,chkQty:0,teams:{}};stats[c].total++;stats[c].qty+=qtyOf(d);if(isValidStat(d)){stats[c].valid++;stats[c].validQty+=qtyOf(d);if(isExc(d))stats[c].excQty+=qtyOf(d);}if(isChk(d))stats[c].chkQty+=qtyOf(d);if(d['团队'])stats[c].teams[d['团队']]=1;});
  var rows=Object.keys(stats).map(function(c){var s=stats[c];return {carrier:c,total:s.total,valid:s.valid,qty:s.qty,compRate:s.validQty?((s.validQty-s.excQty)/s.validQty*100).toFixed(2):0,excRate:s.validQty?(s.excQty/s.validQty*100).toFixed(2):0,chkRate:s.qty?(s.chkQty/s.qty*100).toFixed(2):0,teams:Object.keys(s.teams).join('/')};});
  rows.sort(function(a,b){return b.total-a.total;});
  var q=document.getElementById('t2-searchInput').value.toLowerCase().trim();
  if(q)rows=rows.filter(function(r){return r.carrier.toLowerCase().indexOf(q)>-1;});
  var total=rows.length,pages=Math.ceil(total/t2DetailState.pageSize)||1;if(t2DetailState.page>pages)t2DetailState.page=1;
  var start=(t2DetailState.page-1)*t2DetailState.pageSize,pd=rows.slice(start,start+t2DetailState.pageSize);
  var cols=[{k:'rank',l:'排名'},{k:'carrier',l:'物流商'},{k:'teams',l:'发货团队'},{k:'total',l:'箱数'},{k:'qty',l:'件数'},{k:'compRate',l:'达标率'},{k:'excRate',l:'超时率'},{k:'chkRate',l:'查验率'}];
  document.querySelector('#t2-detailTable thead').innerHTML='<tr>'+cols.map(function(c){return '<th>'+c.l+'</th>';}).join('')+'</tr>';
  document.querySelector('#t2-detailTable tbody').innerHTML=pd.map(function(r,i){var rank=start+i+1;var compColor=r.compRate>=80?'tag-green':(r.compRate>=60?'tag-orange':'tag-red');var excColor=r.excRate>30?'tag-red':(r.excRate>15?'tag-orange':'tag-green');return '<tr style="cursor:pointer" onclick="t2ShowCarrierDetail(\''+escapeAttr(r.carrier)+'\')"><td>'+rank+'</td><td style="font-weight:600;color:#4c1d95">'+escapeHtml(r.carrier)+'</td><td>'+escapeHtml(r.teams)+'</td><td>'+r.total+'</td><td>'+r.qty.toLocaleString()+'</td><td><span class="tag '+compColor+'">'+r.compRate+'%</span></td><td><span class="tag '+excColor+'">'+r.excRate+'%</span></td><td>'+(r.chkRate>0?'<span class="tag '+(r.chkRate>10?'tag-red':'tag-orange')+'">'+r.chkRate+'%</span>':'-')+'</td></tr>';}).join('')||'<tr><td colspan="8" class="empty">无数据</td></tr>';
  document.getElementById('t2-detailCount').textContent='共 '+total+' 家物流商';
  document.getElementById('t2-pager').innerHTML='<button onclick="t2GoPage(1)" '+(t2DetailState.page<=1?'disabled':'')+'>首页</button><button onclick="t2GoPage('+(t2DetailState.page-1)+')" '+(t2DetailState.page<=1?'disabled':'')+'>上一页</button><span class="info">第 '+t2DetailState.page+' / '+pages+' 页</span><button onclick="t2GoPage('+(t2DetailState.page+1)+')" '+(t2DetailState.page>=pages?'disabled':'')+'>下一页</button><button onclick="t2GoPage('+pages+')" '+(t2DetailState.page>=pages?'disabled':'')+'>末页</button>';
}
function t2GoPage(p){t2DetailState.page=p;t2RenderTable();}
function t2ShowCarrierDetail(carrier){
  var data=t2BoxData.filter(function(d){return d['物流商']===carrier&&t2FilterBox(d);});
  var validData=data.filter(isValidStat);
  var totalQty=data.reduce(function(s,d){return s+qtyOf(d);},0);
  var validQty=validData.reduce(function(s,d){return s+qtyOf(d);},0);
  var excQty=validData.filter(isExc).reduce(function(s,d){return s+qtyOf(d);},0);
  var chkQty=data.filter(isChk).reduce(function(s,d){return s+qtyOf(d);},0);
  var exc=validData.filter(isExc);
  var html='<div style="margin-bottom:16px"><h3 style="color:#4c1d95;margin-bottom:8px">'+escapeHtml(carrier)+' 详情</h3><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px"><div class="kpi"><div class="k-label">总箱数</div><div class="k-value">'+data.length+'</div></div><div class="kpi"><div class="k-label">总件数</div><div class="k-value">'+Math.round(totalQty).toLocaleString()+'</div></div><div class="kpi"><div class="k-label">超时件数</div><div class="k-value" style="color:#dc2626">'+Math.round(excQty).toLocaleString()+'</div></div><div class="kpi"><div class="k-label">查验件数</div><div class="k-value" style="color:#c2410c">'+Math.round(chkQty).toLocaleString()+'</div></div><div class="kpi"><div class="k-label">达标率(按件)</div><div class="k-value">'+(validQty?((validQty-excQty)/validQty*100).toFixed(2):0)+'%</div></div></div></div>';
  html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0"><div class="chart-card"><div class="ctitle">月度达标率/超时率趋势</div><div class="chart-box" id="t2-detail-trend" style="height:240px"></div></div><div class="chart-card"><div class="ctitle">运输类型达标率</div><div class="chart-box" id="t2-detail-transport" style="height:240px"></div></div></div>';
  html+='<h4 style="color:#4c1d95;margin:12px 0 8px">异常订单明细 (前50条) <span style="font-size:12px;color:#9ca3af;font-weight:normal">点击行可查看单号详情</span></h4><div style="overflow-x:auto;max-height:400px"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f5f3ff"><th style="padding:8px;text-align:left">入库单号</th><th style="padding:8px;text-align:left">箱号</th><th style="padding:8px;text-align:left">运输类型</th><th style="padding:8px;text-align:left">提货时间</th><th style="padding:8px;text-align:left">目的仓</th><th style="padding:8px;text-align:left">件数</th><th style="padding:8px;text-align:left">异常类型</th></tr></thead><tbody>';
  exc.slice(0,50).forEach(function(d){html+='<tr style="border-bottom:1px solid #f3f0ff;cursor:pointer" onclick="closeModal();switchTab(\'tab1\');setTimeout(function(){document.getElementById(\'t1-lookupInput\').value=\''+escapeAttr(d['入库单号'])+'\';t1DoLookup();},100)"><td style="padding:6px 8px">'+escapeHtml(d['入库单号'])+'</td><td style="padding:6px 8px">'+escapeHtml(d['箱号'])+'</td><td style="padding:6px 8px">'+escapeHtml(d['运输类型'])+'</td><td style="padding:6px 8px">'+fmtT(d['提货时间'])+'</td><td style="padding:6px 8px">'+escapeHtml(d['目的仓库'])+'</td><td style="padding:6px 8px">'+qtyOf(d)+'</td><td style="padding:6px 8px">'+escapeHtml(d['物流异常']||'-')+'</td></tr>';});
  html+='</tbody></table></div>';
  openModal(carrier+' 详情',html);
  setTimeout(function(){ t2RenderDetailCharts(data,carrier); }, 60);
}
function t2RenderDetailCharts(data,carrier){
  // 月度趋势(按件数)
  var mg={};data.forEach(function(d){var m=(d['收件年份']||'')+'-'+(d['收件月份']||'');if(!m||m==='-')return;if(!mg[m])mg[m]={totalQty:0,excQty:0};mg[m].totalQty+=qtyOf(d);if(isExc(d))mg[m].excQty+=qtyOf(d);});
  var months=Object.keys(mg).sort();
  var trendEl=document.getElementById('t2-detail-trend');
  if(trendEl){
    var tc=echarts.init(trendEl);allCharts['t2-detail-trend']=tc;
    tc.setOption({tooltip:{trigger:'axis'},legend:{bottom:0,textStyle:{fontSize:11}},grid:{left:10,right:20,top:20,bottom:40,containLabel:true},xAxis:{type:'category',data:months,axisLabel:{color:'#6b7280',fontSize:10}},yAxis:{type:'value',max:100,axisLabel:{color:'#9ca3af',formatter:'{value}%'}},series:[{name:'达标率%',type:'line',smooth:true,data:months.map(function(m){return mg[m].totalQty?+((mg[m].totalQty-mg[m].excQty)/mg[m].totalQty*100).toFixed(2):0;}),itemStyle:{color:'#7c3aed'},areaStyle:{color:'rgba(124,58,237,.15)'}},{name:'超时率%',type:'line',smooth:true,data:months.map(function(m){return mg[m].totalQty?+(mg[m].excQty/mg[m].totalQty*100).toFixed(2):0;}),itemStyle:{color:'#dc2626'},areaStyle:{color:'rgba(220,38,38,.1)'}}]});
  }
  // 运输类型达标率(按件数)
  var tg={};data.forEach(function(d){var t=d['运输类型']||'未知';if(!tg[t])tg[t]={totalQty:0,excQty:0};tg[t].totalQty+=qtyOf(d);if(isExc(d))tg[t].excQty+=qtyOf(d);});
  var tNames=Object.keys(tg);
  var tEl=document.getElementById('t2-detail-transport');
  if(tEl){
    var tcc=echarts.init(tEl);allCharts['t2-detail-transport']=tcc;
    tcc.setOption({tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(p){var s=tg[tNames[p[0].dataIndex]];return p[0].name+'<br/>达标率: '+p[0].value+'%<br/>总件数: '+Math.round(s.totalQty)+'<br/>超时件数: '+Math.round(s.excQty);}},grid:{left:10,right:20,top:20,bottom:30,containLabel:true},xAxis:{type:'category',data:tNames,axisLabel:{color:'#6b7280',fontSize:10}},yAxis:{type:'value',max:100,axisLabel:{color:'#9ca3af',formatter:'{value}%'}},series:[{type:'bar',data:tNames.map(function(t){return tg[t].totalQty?+((tg[t].totalQty-tg[t].excQty)/tg[t].totalQty*100).toFixed(2):0;}),itemStyle:{color:function(p){var v=p.value;return v>=80?'#7c3aed':(v>=60?'#c2410c':'#dc2626');},borderRadius:[4,4,0,0]},barMaxWidth:40,label:{show:true,position:'top',formatter:'{c}%',fontSize:10}}]});
  }
}
function t2Export(){
  var data=t2BoxData.filter(t2FilterBox);
  var stats={};data.forEach(function(d){var c=d['物流商'];if(!stats[c])stats[c]={total:0,qty:0,validQty:0,excQty:0,chkQty:0};stats[c].total++;stats[c].qty+=qtyOf(d);if(isValidStat(d)){stats[c].validQty+=qtyOf(d);if(isExc(d))stats[c].excQty+=qtyOf(d);}if(isChk(d))stats[c].chkQty+=qtyOf(d);});
  var cols=['物流商','箱数','件数','超时件数','查验件数','达标率(按件)','超时率(按件)','查验率(按件)'];
  var csv='\uFEFF'+cols.join(',')+'\n';
  Object.keys(stats).sort(function(a,b){return stats[b].qty-stats[a].qty;}).forEach(function(c){var s=stats[c];csv+='"'+c+'",'+s.total+','+Math.round(s.qty)+','+Math.round(s.excQty)+','+Math.round(s.chkQty)+','+(s.validQty?((s.validQty-s.excQty)/s.validQty*100).toFixed(2):0)+'%,'+(s.validQty?(s.excQty/s.validQty*100).toFixed(2):0)+'%,'+(s.qty?(s.chkQty/s.qty*100).toFixed(2):0)+'%\n';});
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='物流商异常时效_'+new Date().toLocaleDateString().replace(/\//g,'')+'.csv';a.click();
}

// ============ Tab2 补全函数 ============
function t2RenderMonthlyCross(){
  var data=t2BoxData.filter(t2FilterBox);
  var monthMap={},transportTypes={};
  data.forEach(function(d){
    var y=d['收件年份'],mo=d['收件月份'];
    if(!y||!mo)return;
    var month=y+'-'+mo;
    var type=d['运输类型']||'未知';
    if(!monthMap[month])monthMap[month]={};
    if(!monthMap[month][type])monthMap[month][type]={totalQty:0,excQty:0};
    monthMap[month][type].totalQty+=qtyOf(d);
    if(isExc(d))monthMap[month][type].excQty+=qtyOf(d);
    transportTypes[type]=1;
  });
  var months=Object.keys(monthMap).sort();
  var types=Object.keys(transportTypes).sort();
  var box=document.getElementById('t2-monthlyCross');
  if(!months.length){box.innerHTML='<div class="empty">无数据</div>';return;}
  var html='<table class="cross-table"><thead><tr><th>月份</th>';
  types.forEach(function(t){html+='<th>'+escapeHtml(t)+'</th>';});
  html+='</tr></thead><tbody>';
  months.forEach(function(m){
    html+='<tr><td style="font-weight:600;color:#4c1d95">'+escapeHtml(m)+'</td>';
    types.forEach(function(t){
      var item=monthMap[m][t]||{totalQty:0,excQty:0};
      var rate=item.totalQty?((item.totalQty-item.excQty)/item.totalQty*100).toFixed(2):0;
      var r=parseFloat(rate);
      var color=r>=80?'#7c3aed':(r>=60?'#c2410c':'#dc2626');
      html+='<td><div class="rate-cell"><div class="rate-bar-bg"><div class="rate-bar" style="width:'+rate+'%;background:'+color+'"></div></div><span class="rate-text" style="color:'+color+'">'+rate+'%</span><span class="rate-sub">'+Math.round(item.totalQty)+'件</span></div></td>';
    });
    html+='</tr>';
  });
  html+='</tbody></table>';
  box.innerHTML=html;
}

var t2AnomalyState={page:1,pageSize:50,search:'',type:'',month:''};
function t2ShowAnomalyOrders(type){
  t2AnomalyState.type=type;t2AnomalyState.page=1;t2AnomalyState.search='';t2AnomalyState.month='';
  var data=t2BoxData.filter(t2FilterBox);
  var sourceMap={total:'全部',domestic:'国内',bangladesh:'孟加拉'};
  var srcLbl=sourceMap[t2Source]?(sourceMap[t2Source]!=='全部'?'（'+sourceMap[t2Source]+'）':''):'';
  var html='<div style="margin-bottom:14px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px"><input type="text" id="t2-anomalySearch" placeholder="搜索 入库单号/箱号/物流商/目的仓..." oninput="t2AnomalyState.search=this.value;t2AnomalyState.page=1;t2RenderAnomalyTable()" style="padding:7px 12px;border:1px solid #ddd6fe;border-radius:8px;font-size:13px;width:280px;outline:none"><select id="t2-anomalyMonth" onchange="t2AnomalyState.month=this.value;t2AnomalyState.page=1;t2RenderAnomalyTable()" style="padding:7px 10px;border:1px solid #ddd6fe;border-radius:8px;font-size:13px;background:#faf8ff;color:#4c1d95"></select><span style="margin-left:auto;font-size:13px;color:#6b7280" id="t2-anomalyCount"></span></div><div id="t2-anomalyBody"></div><div class="pager" id="t2-anomalyPager"></div></div>';
  openModal(type+srcLbl+' - 异常订单详情',html);
  var months={};data.forEach(function(d){var m=(d['收件年份']||'')+'-'+(d['收件月份']||'');if(m&&m!=='-')months[m]=1;});
  var sel=document.getElementById('t2-anomalyMonth');
  sel.innerHTML='<option value="">全部月份</option>'+Object.keys(months).sort().map(function(m){return '<option value="'+m+'">'+m+'</option>';}).join('');
  t2RenderAnomalyTable();
}
function t2RenderAnomalyTable(){
  var data=t2BoxData.filter(t2FilterBox);
  var filtered=data.filter(function(d){
    if(t2AnomalyState.type==='超时异常'&&!isExc(d))return false;
    if(t2AnomalyState.type==='查验异常'&&!isChk(d))return false;
    if(t2AnomalyState.month){var m=(d['收件年份']||'')+'-'+(d['收件月份']||'');if(m!==t2AnomalyState.month)return false;}
    if(t2AnomalyState.search){var s=t2AnomalyState.search.toLowerCase();var hay=(d['入库单号']+' '+d['箱号']+' '+d['物流商']+' '+d['目的仓库']+' '+d['运输类型']).toLowerCase();if(hay.indexOf(s)===-1)return false;}
    return true;
  });
  var mg={};filtered.forEach(function(d){var m=(d['收件年份']||'')+'-'+(d['收件月份']||'');if(m&&m!=='-')mg[m]=(mg[m]||0)+1;});
  var months=Object.keys(mg).sort();
  var statsHtml='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;padding:10px;background:#faf8ff;border-radius:8px">';
  if(months.length){statsHtml+='<div style="font-size:12px;color:#6b7280;margin-right:8px;line-height:24px">月度分布:</div>';months.forEach(function(m){statsHtml+='<span style="padding:3px 10px;background:#fff;border:1px solid #ddd6fe;border-radius:12px;font-size:12px;color:#4c1d95">'+escapeHtml(m)+': <b>'+mg[m]+'</b></span>';});}else{statsHtml+='<span style="font-size:12px;color:#9ca3af">暂无数据</span>';}
  statsHtml+='</div>';
  var total=filtered.length,pages=Math.ceil(total/t2AnomalyState.pageSize)||1;
  if(t2AnomalyState.page>pages)t2AnomalyState.page=1;
  var start=(t2AnomalyState.page-1)*t2AnomalyState.pageSize,pd=filtered.slice(start,start+t2AnomalyState.pageSize);
  var cols=['入库单号','箱号','物流商','运输类型','时效要求','提货时间','目的仓','团队','异常类型','延迟说明'];
  var tableHtml='<div style="overflow-x:auto;max-height:420px"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f5f3ff;position:sticky;top:0">'+cols.map(function(c){return '<th style="padding:8px;text-align:left;color:#4c1d95;white-space:nowrap">'+c+'</th>';}).join('')+'</tr></thead><tbody>';
  tableHtml+=pd.map(function(d){
    var atype=t2AnomalyState.type==='超时异常'?(d['物流异常']||'超时'):'查验异常';
    var delayDesc=d['延迟说明']||'';
    return '<tr style="border-bottom:1px solid #f3f0ff;cursor:pointer" onclick="closeModal();switchTab(\'tab1\');setTimeout(function(){document.getElementById(\'t1-lookupInput\').value=\''+escapeAttr(d['入库单号'])+'\';t1DoLookup();},100)"><td style="padding:6px 8px">'+escapeHtml(d['入库单号']||'')+'</td><td style="padding:6px 8px">'+escapeHtml(d['箱号']||'')+'</td><td style="padding:6px 8px;font-weight:600;color:#4c1d95">'+escapeHtml(d['物流商']||'')+'</td><td style="padding:6px 8px">'+escapeHtml(d['运输类型']||'')+'</td><td style="padding:6px 8px">'+escapeHtml(d['时效要求']||'')+'</td><td style="padding:6px 8px">'+fmtT(d['提货时间'])+'</td><td style="padding:6px 8px">'+escapeHtml(d['目的仓库']||'')+'</td><td style="padding:6px 8px">'+escapeHtml(d['团队']||'')+'</td><td style="padding:6px 8px"><span class="tag tag-red">'+escapeHtml(atype)+'</span></td><td style="padding:6px 8px;color:#c2410c;max-width:200px;word-break:break-all">'+escapeHtml(delayDesc)+'</td></tr>';
  }).join('')||'<tr><td colspan="10" class="empty">无匹配数据</td></tr>';
  tableHtml+='</tbody></table></div>';
  document.getElementById('t2-anomalyBody').innerHTML=statsHtml+tableHtml;
  document.getElementById('t2-anomalyCount').textContent='共 '+total+' 条';
  document.getElementById('t2-anomalyPager').innerHTML='<button onclick="t2AnomalyGoPage(1)" '+(t2AnomalyState.page<=1?'disabled':'')+'>首页</button><button onclick="t2AnomalyGoPage('+(t2AnomalyState.page-1)+')" '+(t2AnomalyState.page<=1?'disabled':'')+'>上一页</button><span class="info">第 '+t2AnomalyState.page+' / '+pages+' 页</span><button onclick="t2AnomalyGoPage('+(t2AnomalyState.page+1)+')" '+(t2AnomalyState.page>=pages?'disabled':'')+'>下一页</button><button onclick="t2AnomalyGoPage('+pages+')" '+(t2AnomalyState.page>=pages?'disabled':'')+'>末页</button><span class="info">每页</span><select onchange="t2AnomalyState.pageSize=parseInt(this.value);t2AnomalyState.page=1;t2RenderAnomalyTable()" style="padding:4px 8px;border:1px solid #ddd6fe;border-radius:4px;font-size:12px"><option value="30"'+(t2AnomalyState.pageSize===30?' selected':'')+'>30</option><option value="50"'+(t2AnomalyState.pageSize===50?' selected':'')+'>50</option><option value="100"'+(t2AnomalyState.pageSize===100?' selected':'')+'>100</option></select><span class="info">条</span>';
}
function t2AnomalyGoPage(p){t2AnomalyState.page=p;t2RenderAnomalyTable();}

function t2OpenChartModal(id,title){
  var src=allCharts[id];
  if(!src)return;
  var opt=src.getOption();
  openModal(title+'（放大查看）','<div id="t2-modalChart" style="width:100%;height:60vh;min-height:400px"></div>');
  setTimeout(function(){
    var el=document.getElementById('t2-modalChart');
    if(!el)return;
    var mc=echarts.init(el);allCharts['t2-modalChart']=mc;
    mc.setOption(opt);
  },60);
}

function t2ShowMethod(){
  var html='<div style="font-size:14px;line-height:1.9;color:#374151">'+
    '<h3 style="color:#4c1d95;margin-bottom:12px">指标口径说明</h3>'+
    '<div style="background:#faf8ff;border-radius:8px;padding:14px;margin-bottom:12px"><b style="color:#7c3aed">时效达标率</b><br>达标率 = (有效统计件数 - 超时件数) / 有效统计件数 × 100%（按件数计算）。<br>判定依据：自算时效天数 = 上架时间 - 提货时间（天），再与时效要求上限比较（PERIOD_LIMITS：4天→7天, 7天→9天, 8天→8天, 10天→12天, 15天→15天, 30天→32天, 38天→38天）。<br>有效统计：时效要求和时效天数都不为空的行才计入统计，按计划数量（件数）加权。</div>'+
    '<div style="background:#faf8ff;border-radius:8px;padding:14px;margin-bottom:12px"><b style="color:#7c3aed">超时异常率</b><br>超时异常率 = 超时件数 / 有效统计件数 × 100%（按件数计算）。点击KPI卡片可查看异常订单明细。</div>'+
    '<div style="background:#faf8ff;border-radius:8px;padding:14px;margin-bottom:12px"><b style="color:#7c3aed">查验异常率</b><br>查验异常率 = 查验件数 / 总件数 × 100%（按件数计算）。判定依据：「是否查验」字段为「是」。点击KPI卡片可查看查验订单明细。</div>'+
    '<div style="background:#faf8ff;border-radius:8px;padding:14px;margin-bottom:12px"><b style="color:#7c3aed">数据来源切换</b><br>全部：当前筛选范围内的全部箱数据；国内：发货仓库不为「168」；孟加拉(168)：发货仓库为「168」。</div>'+
    '<div style="background:#faf8ff;border-radius:8px;padding:14px;margin-bottom:12px"><b style="color:#7c3aed">提货日期筛选</b><br>基于「提货时间」字段过滤，支持快捷选择近7天/近30天/本月/上月。</div>'+
    '<div style="background:#faf8ff;border-radius:8px;padding:14px"><b style="color:#7c3aed">交叉分析表</b><br>按「收件年份-月份」×「运输类型」分组，单元格显示该组的达标率，颜色区分：紫色≥80%、橙色60-80%、红色<60%。</div>'+
    '</div>';
  openModal('口径说明',html);
}

// ============================================================
// Tab3: 价格看板
// ============================================================
var t3Filters = { '月份':[],'运输类型':[],'一级分类':[],'时效要求':[],'发货团队':[],'目的地分类':[],'发货地':[],'物流商':[],dateStart:'',dateEnd:'' };
var t3Mselects = {};
function t3InitFilters(){
  var cfgs = [
    {id:'t3-f-month',key:'月份',opts:uniqueVals(frData,'月份').sort()},
    {id:'t3-f-transport',key:'运输类型',opts:uniqueVals(frData,'运输类型')},
    {id:'t3-f-cat',key:'一级分类',opts:uniqueVals(frData,'一级分类')},
    {id:'t3-f-period',key:'时效要求',opts:uniqueVals(frData,'时效要求')},
    {id:'t3-f-team',key:'发货团队',opts:uniqueVals(frData,'发货团队')},
    {id:'t3-f-desttype',key:'目的地分类',opts:uniqueVals(frData,'目的地分类')},
    {id:'t3-f-origin',key:'发货地',opts:uniqueVals(frData,'发货地')},
    {id:'t3-f-carrier',key:'物流商',opts:uniqueVals(frData,'物流商')}
  ];
  cfgs.forEach(function(c){ t3Mselects[c.key]=initMselect(c.id,c.key,c.opts,t3Filters,t3Render); });
}
function t3Reset(){ for(var k in t3Mselects){t3Mselects[k].reset();} t3Filters.dateStart='';t3Filters.dateEnd='';document.getElementById('t3-dateStart').value='';document.getElementById('t3-dateEnd').value=''; t3Render(); }
function t3FilterFr(d){
  for(var k in t3Filters){ if(k==='dateStart'||k==='dateEnd')continue; var fk=k==='发货团队'?'发货团队':k; if(t3Filters[k].length&&t3Filters[k].indexOf(String(d[fk]))===-1) return false; }
  if(t3Filters.dateStart||t3Filters.dateEnd){var dt=d['提货日期'];if(!dt)return false;if(t3Filters.dateStart&&dt<t3Filters.dateStart)return false;if(t3Filters.dateEnd&&dt>t3Filters.dateEnd)return false;}
  return true;
}
function t3Num(v){ var n=Number(v); return isNaN(n)?0:n; }
// 注意：initChart 调用移到 DOMContentLoaded 中执行，避免 DOM 未就绪导致 echarts.init(null) 崩溃
// ['t3-c-transport','t3-c-carrier','t3-c-week','t3-c-scatter','t3-c-boxtype','t3-c-channel','t3-c-carrieravg','t3-c-channelavg','t3-c-weekqty','t3-c-weekweight','t3-c-weekavg','t3-c-boxcost'].forEach(initChart);
var T3_CHART_IDS=['t3-c-transport','t3-c-carrier','t3-c-week','t3-c-scatter','t3-c-boxtype','t3-c-channel','t3-c-carrieravg','t3-c-channelavg','t3-c-weekqty','t3-c-weekweight','t3-c-weekavg','t3-c-boxcost'];
function t3InitCharts(){T3_CHART_IDS.forEach(initChart);}
// 安全 setOption 封装：图表未初始化或被销毁时跳过，不抛异常（Tab2/Tab3 通用）
function t3SetOption(id,opt){var c=allCharts[id];if(!c){console.warn('t3SetOption: chart #'+id+' not ready, skipped');return;}try{c.setOption(opt,true);}catch(e){console.error('t3SetOption #'+id+' failed:',e);}}
function t3SwitchSub(id,evt){
  document.querySelectorAll('#tab3 .subtab').forEach(function(t){t.classList.remove('active');});
  document.querySelectorAll('#tab3 .subpanel').forEach(function(t){t.classList.remove('active');});
  var btn=(evt&&evt.target)?evt.target:document.querySelector('#tab3 .subtab[onclick*="'+id+'"]');
  if(btn)btn.classList.add('active');
  document.getElementById(id).classList.add('active');
  setTimeout(function(){ for(var k in allCharts){ if(k.indexOf('t3-c-')===0&&allCharts[k]) allCharts[k].resize(); } },60);
}
function t3OpenChartModal(id,title){
  var src=allCharts[id];
  if(!src)return;
  var opt=src.getOption();
  openModal(title+'（放大查看）','<div id="t3-modalChart" style="width:100%;height:60vh;min-height:400px"></div>');
  setTimeout(function(){
    var el=document.getElementById('t3-modalChart');
    if(!el)return;
    var mc=echarts.init(el);allCharts['t3-modalChart']=mc;
    mc.setOption(opt);
  },60);
}
var t3DetailState={page:1,pageSize:50,search:'',sortField:'总金额',sortDir:'desc'};
// 转义字符串用于 onclick 内单引号 JS 字符串(双引号属性)
function t3EscS(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;');}
var t3Types=['空运','快递','海运'];
var t3Colors={'空运':'#3498DB','快递':'#E74C3C','海运':'#2ECC71'};
var t3Icons={'空运':'✈','快递':'🚚','海运':'🚢'};
function t3IsPriced(d){return parsePrice(d['单价'])!==null||t3Num(d['运费'])>0;}
function t3Render(){
  var data=frData.filter(t3FilterFr);
  // 全部记录维度（原版规格）
  var totalRecords=data.length;
  var totalPieces=data.reduce(function(s,d){return s+t3Num(d['件数']);},0);
  var totalVolume=data.reduce(function(s,d){return s+t3Num(d['体积重']);},0);
  // 全部记录维度的原始费用字段
  var totalFreight=data.reduce(function(s,d){return s+t3Num(d['运费']);},0);
  var totalInsurance=data.reduce(function(s,d){return s+t3Num(d['保险费']);},0);
  var totalCustoms=data.reduce(function(s,d){return s+t3Num(d['报关费']);},0);
  var totalTariff=data.reduce(function(s,d){return s+t3Num(d['关税']);},0);
  // priced记录维度（单价解析不为空 或 运费>0）
  var priced=data.filter(t3IsPriced);
  var totalCost=priced.reduce(function(s,d){return s+t3CalcTotalCost(d);},0);
  var pricedPieces=priced.reduce(function(s,d){return s+t3Num(d['件数']);},0);
  var avgPerPiece=pricedPieces>0?(totalCost/pricedPieces):0;
  var carriers={};data.forEach(function(d){if(d['物流商'])carriers[d['物流商']]=1;});
  var channels={};data.forEach(function(d){if(d['物流渠道'])channels[d['物流渠道']]=1;});
  document.getElementById('t3-kpiRow').innerHTML=[
    {l:'总记录数',v:totalRecords.toLocaleString(),s:'运费记录条数',u:'条'},
    {l:'总发货件数',v:Math.round(totalPieces).toLocaleString(),s:'件数求和',u:'件'},
    {l:'总体积重',v:t3Fmt(totalVolume,1),s:'体积重求和',u:'kg'},
    {l:'总运费',v:'¥'+t3Fmt(totalCost,0),s:'运费+保险费+报关费+关税+保税仓费',u:''},
    {l:'按件均价',v:'¥'+t3Fmt(avgPerPiece,2),s:'总运费÷priced件数',u:'/件'},
    {l:'运费',v:'¥'+t3Fmt(totalFreight,0),s:'预处理字段求和(含燃油)',u:''},
    {l:'保险费',v:'¥'+t3Fmt(totalInsurance,0),s:'按物流商规则计算(假发)',u:''},
    {l:'报关费',v:'¥'+t3Fmt(totalCustoms,0),s:'报关=是:350元',u:''},
    {l:'关税',v:'¥'+t3Fmt(totalTariff,0),s:'168UPS5/件 168aramex8/件 快递3.5/件',u:''},
    {l:'物流商数',v:Object.keys(carriers).length.toLocaleString(),s:'去重物流商',u:'家'},
    {l:'物流渠道数',v:Object.keys(channels).length.toLocaleString(),s:'去重渠道',u:'个'}
  ].map(function(c){return '<div class="kpi-card"><div class="label">'+c.l+'</div><div class="value">'+c.v+'<span class="unit">'+c.u+'</span></div><div class="sub">'+c.s+'</div></div>';}).join('');
  document.getElementById('t3-filterCount').textContent='当前筛选: '+data.length+' / '+frData.length+' 条';
  // 周聚合(按运输类型)
  var weekAgg={};
  data.forEach(function(d){var dt=parseDate(d['提货日期']);if(!dt)return;var w=isoWeek(dt);if(!weekAgg[w])weekAgg[w]={};var t=d['运输类型'];if(!weekAgg[w][t])weekAgg[w][t]={vol:0,fee:0,qty:0,cost:0,weight:0};if(t3IsPriced(d)){weekAgg[w][t].vol+=t3CalcVolWeight(d);weekAgg[w][t].fee+=t3CalcFee(d);}weekAgg[w][t].qty+=t3Num(d['件数']);weekAgg[w][t].cost+=t3CalcTotalCost(d);weekAgg[w][t].weight+=t3CalcVolWeight(d);});
  var weekArr=Object.keys(weekAgg).sort();
  // 各运输类型周度均价趋势 (t3-c-weekavg) 多线
  t3SetOption('t3-c-weekavg',{tooltip:{trigger:'axis',formatter:function(p){var s=p[0].name;p.forEach(function(it){s+='<br/>'+it.marker+it.seriesName+': '+(it.value===null?'-':'¥'+Number(it.value).toFixed(2));});return s;}},legend:{data:t3Types,bottom:0,textStyle:{fontSize:11,color:'#6b7280'}},grid:{left:10,right:20,top:20,bottom:60,containLabel:true},xAxis:{type:'category',data:weekArr,axisLabel:{rotate:35,color:'#6b7280',fontSize:10}},yAxis:{type:'value',name:'均价(¥)',axisLabel:{color:'#9ca3af'}},dataZoom:[{type:'inside'},{type:'slider',height:16,bottom:10}],series:t3Types.map(function(t){var c=t3Colors[t];return {name:t,type:'line',smooth:true,symbol:'circle',symbolSize:6,connectNulls:true,lineStyle:{width:2,color:c},itemStyle:{color:c},data:weekArr.map(function(w){var s=weekAgg[w][t];if(!s||s.vol===0)return null;return Math.round(s.fee/s.vol*100)/100;})};})},true);
  // 各运输类型周度发货量 (t3-c-weekqty) 多柱
  t3SetOption('t3-c-weekqty',{tooltip:{trigger:'axis'},legend:{data:t3Types,bottom:0,textStyle:{fontSize:11,color:'#6b7280'}},grid:{left:10,right:20,top:20,bottom:60,containLabel:true},xAxis:{type:'category',data:weekArr,axisLabel:{rotate:35,color:'#6b7280',fontSize:10}},yAxis:{type:'value',name:'件数',axisLabel:{color:'#9ca3af'}},dataZoom:[{type:'inside'},{type:'slider',height:16,bottom:10}],series:t3Types.map(function(t){var c=t3Colors[t];return {name:t,type:'bar',barMaxWidth:24,itemStyle:{color:c,borderRadius:[4,4,0,0]},data:weekArr.map(function(w){var s=weekAgg[w][t];return s?Math.round(s.qty):0;})};})},true);
  // 周度总费用趋势 (t3-c-week) 单线(总金额)
  var weekCost={},weekWeight={};
  data.forEach(function(d){var dt=parseDate(d['提货日期']);if(!dt)return;var w=isoWeek(dt);weekCost[w]=(weekCost[w]||0)+t3CalcTotalCost(d);weekWeight[w]=(weekWeight[w]||0)+t3CalcVolWeight(d);});
  var wcArr=Object.keys(weekCost).sort();
  t3SetOption('t3-c-week',{tooltip:{trigger:'axis',formatter:function(p){return p[0].name+': ¥'+p[0].value.toLocaleString();}},grid:{left:10,right:20,top:20,bottom:60,containLabel:true},xAxis:{type:'category',data:wcArr,axisLabel:{rotate:35,color:'#6b7280',fontSize:10}},yAxis:{type:'value',name:'总金额(元)',axisLabel:{color:'#9ca3af',formatter:function(v){return v>=10000?(v/10000).toFixed(1)+'万':v;}}},dataZoom:[{type:'inside'},{type:'slider',height:16,bottom:10}],series:[{type:'line',data:wcArr.map(function(w){return Math.round(weekCost[w]);}),smooth:true,symbol:'circle',symbolSize:6,lineStyle:{width:2,color:'#7c3aed'},itemStyle:{color:'#7c3aed'},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(124,58,237,.3)'},{offset:1,color:'rgba(124,58,237,.02)'}])}}]},true);
  // 周度总体积重趋势 (t3-c-weekweight) 单线
  var wwArr=Object.keys(weekWeight).sort();
  t3SetOption('t3-c-weekweight',{tooltip:{trigger:'axis',formatter:function(p){return p[0].name+': '+p[0].value.toLocaleString()+' kg';}},grid:{left:10,right:20,top:20,bottom:60,containLabel:true},xAxis:{type:'category',data:wwArr,axisLabel:{rotate:35,color:'#6b7280',fontSize:10}},yAxis:{type:'value',name:'体积重(kg)',axisLabel:{color:'#9ca3af'}},dataZoom:[{type:'inside'},{type:'slider',height:16,bottom:10}],series:[{type:'line',data:wwArr.map(function(w){return Math.round(weekWeight[w]);}),smooth:true,symbol:'circle',symbolSize:6,lineStyle:{width:2,color:'#6d28d9'},itemStyle:{color:'#6d28d9'},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(109,40,217,.3)'},{offset:1,color:'rgba(109,40,217,.02)'}])}}]},true);
  // 运输类型费用汇总 (t3-c-transport)
  var tStats={};data.forEach(function(d){var t=d['运输类型'];if(!tStats[t])tStats[t]={cost:0,qty:0,box:0};tStats[t].cost+=t3CalcTotalCost(d);tStats[t].qty+=t3Num(d['件数']);tStats[t].box+=t3Num(d['箱数确认']);});
  var tNames=Object.keys(tStats);
  t3SetOption('t3-c-transport',{tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(p){var s=tStats[tNames[p[0].dataIndex]];return p[0].name+'<br/>总金额: ¥'+p[0].value.toLocaleString()+'<br/>件数: '+s.qty+'<br/>箱数: '+s.box;}},grid:{left:10,right:20,top:30,bottom:30,containLabel:true},xAxis:{type:'category',data:tNames,axisLabel:{color:'#6b7280'}},yAxis:{type:'value',name:'总金额(元)',axisLabel:{color:'#9ca3af',formatter:function(v){return v>=10000?(v/10000).toFixed(1)+'万':v;}}},series:[{type:'bar',data:tNames.map(function(t){return Math.round(tStats[t].cost);}),itemStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#7c3aed'},{offset:1,color:'#c4b5fd'}]),borderRadius:[4,4,0,0]},barMaxWidth:50,label:{show:true,position:'top',formatter:function(p){var v=p.value;return v>=10000?(v/10000).toFixed(1)+'万':v;},color:'#6b7280',fontSize:11}}]});
  // 物流商总费用对比 Top12 (t3-c-carrier)
  var cStats={};data.forEach(function(d){var c=d['物流商'];cStats[c]=(cStats[c]||0)+t3CalcTotalCost(d);});
  var cArr=toSortedPairs(cStats,true).slice(0,12);
  t3SetOption('t3-c-carrier',{tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(p){return p[0].name+': ¥'+p[0].value.toLocaleString();}},grid:{left:10,right:20,top:20,bottom:60,containLabel:true},xAxis:{type:'category',data:cArr.map(function(a){return a[0];}),axisLabel:{rotate:35,color:'#6b7280',fontSize:11}},yAxis:{type:'value',name:'总金额(元)',axisLabel:{color:'#9ca3af',formatter:function(v){return v>=10000?(v/10000).toFixed(1)+'万':v;}}},series:[{type:'bar',data:cArr.map(function(a){return Math.round(a[1]);}),itemStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#8b5cf6'},{offset:1,color:'#ddd6fe'}]),borderRadius:[4,4,0,0]},barMaxWidth:36}]});
  // 物流商按件均价对比 Top12 (t3-c-carrieravg)
  var caStats={};data.forEach(function(d){var c=d['物流商'];if(!t3IsPriced(d))return;if(!caStats[c])caStats[c]={cost:0,qty:0};caStats[c].cost+=t3CalcTotalCost(d);caStats[c].qty+=t3Num(d['件数']);});
  var caArr=Object.keys(caStats).map(function(c){return {name:c,avg:caStats[c].qty?(caStats[c].cost/caStats[c].qty):0,cost:caStats[c].cost,qty:caStats[c].qty};}).sort(function(a,b){return b.cost-a.cost;}).slice(0,12);
  t3SetOption('t3-c-carrieravg',{tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(p){var s=caArr[p[0].dataIndex];return p[0].name+'<br/>按件均价: ¥'+p[0].value.toFixed(2)+'<br/>总运费: ¥'+Math.round(s.cost).toLocaleString()+'<br/>件数: '+Math.round(s.qty);}},grid:{left:10,right:20,top:20,bottom:60,containLabel:true},xAxis:{type:'category',data:caArr.map(function(a){return a.name;}),axisLabel:{rotate:35,color:'#6b7280',fontSize:11}},yAxis:{type:'value',name:'按件均价(元)',axisLabel:{color:'#9ca3af'}},series:[{type:'bar',data:caArr.map(function(a){return +a.avg.toFixed(2);}),itemStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#7c3aed'},{offset:1,color:'#c4b5fd'}]),borderRadius:[4,4,0,0]},barMaxWidth:36,label:{show:true,position:'top',formatter:'¥{c}',color:'#6b7280',fontSize:10}}]});
  // 散点图 (t3-c-scatter) - 每个物流商×运输类型一个气泡
  var scGroups={};data.forEach(function(d){var key=d['物流商']+'__'+d['运输类型'];if(!scGroups[key])scGroups[key]=[];scGroups[key].push(d);});
  var scSeries=t3Types.map(function(t){var c=t3Colors[t];var arr=[];Object.keys(scGroups).forEach(function(key){var parts=key.split('__');var prov=parts[0],tt=parts[1];if(tt!==t)return;var recs=scGroups[key];var prc=recs.filter(t3IsPriced);var vol=prc.reduce(function(s,d){return s+t3CalcVolWeight(d);},0);var fee=prc.reduce(function(s,d){return s+t3CalcFee(d);},0);if(vol===0)return;var avg=fee/vol;var tset={};recs.forEach(function(d){var nums=String(d['时效要求']).match(/\d+/g);if(nums)nums.forEach(function(n){tset[n]=1;});});var nums=Object.keys(tset);if(!nums.length)return;var sum=0;nums.forEach(function(n){sum+=parseInt(n);});var avgT=sum/nums.length;var qty=recs.reduce(function(s,d){return s+t3Num(d['件数']);},0);arr.push({value:[Math.round(avgT*100)/100,Math.round(avg*100)/100,Math.max(8,Math.min(40,Math.sqrt(qty)/3))],prov:prov,t:t,avgT:avgT,avg:avg,qty:qty,vol:vol});});return {name:t,type:'scatter',data:arr,symbolSize:function(d){return d[2];},itemStyle:{color:c,opacity:0.7,borderColor:c,borderWidth:1.5},emphasis:{itemStyle:{opacity:1}}};}).filter(function(s){return s.data.length;});
  t3SetOption('t3-c-scatter',{tooltip:{trigger:'item',formatter:function(p){var d=p.data;return escapeHtml(d.prov)+' ('+d.t+')<br/>时效: '+d.avgT.toFixed(1)+'天<br/>均价: ¥'+d.avg.toFixed(2)+'/kg<br/>件数: '+Math.round(d.qty).toLocaleString()+'<br/>体积重: '+Math.round(d.vol).toLocaleString()+'kg';}},legend:{data:t3Types,bottom:0,textStyle:{fontSize:11,color:'#6b7280'}},grid:{left:10,right:20,top:20,bottom:40,containLabel:true},xAxis:{type:'value',name:'时效(天)',axisLabel:{color:'#9ca3af'}},yAxis:{type:'value',name:'均价(¥/kg)',axisLabel:{color:'#9ca3af'}},series:scSeries},true);
  // 物流渠道费用对比 Top10 (t3-c-channel)
  var chStats={};data.forEach(function(d){var c=d['物流渠道'];chStats[c]=(chStats[c]||0)+t3CalcTotalCost(d);});
  var chArr=toSortedPairs(chStats,true).slice(0,10).reverse();
  t3SetOption('t3-c-channel',{tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(p){return p[0].name+': ¥'+p[0].value.toLocaleString();}},grid:{left:10,right:20,top:10,bottom:20,containLabel:true},xAxis:{type:'value',name:'总金额(元)',axisLabel:{color:'#9ca3af',formatter:function(v){return v>=10000?(v/10000).toFixed(1)+'万':v;}}},yAxis:{type:'category',data:chArr.map(function(a){return a[0];}),axisLabel:{color:'#6b7280',fontSize:11}},series:[{type:'bar',data:chArr.map(function(a){return Math.round(a[1]);}),itemStyle:{color:new echarts.graphic.LinearGradient(1,0,0,0,[{offset:0,color:'#8b5cf6'},{offset:1,color:'#c4b5fd'}]),borderRadius:[0,4,4,0]},barMaxWidth:22,label:{show:true,position:'right',formatter:function(p){var v=p.value;return v>=10000?(v/10000).toFixed(1)+'万':v;},color:'#6b7280',fontSize:10}}]});
  // 渠道按件均价对比 Top10 (t3-c-channelavg)
  var chaStats={};data.forEach(function(d){var c=d['物流渠道'];if(!t3IsPriced(d))return;if(!chaStats[c])chaStats[c]={cost:0,qty:0};chaStats[c].cost+=t3CalcTotalCost(d);chaStats[c].qty+=t3Num(d['件数']);});
  var chaArr=Object.keys(chaStats).map(function(c){return {name:c,avg:chaStats[c].qty?(chaStats[c].cost/chaStats[c].qty):0,cost:chaStats[c].cost};}).sort(function(a,b){return b.cost-a.cost;}).slice(0,10).reverse();
  t3SetOption('t3-c-channelavg',{tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(p){var s=chaArr[p[0].dataIndex];return p[0].name+'<br/>按件均价: ¥'+p[0].value.toFixed(2)+'<br/>总运费: ¥'+Math.round(s.cost).toLocaleString();}},grid:{left:10,right:20,top:20,bottom:20,containLabel:true},xAxis:{type:'value',name:'按件均价(元)',axisLabel:{color:'#9ca3af'}},yAxis:{type:'category',data:chaArr.map(function(a){return a.name;}),axisLabel:{color:'#6b7280',fontSize:11}},series:[{type:'bar',data:chaArr.map(function(a){return +a.avg.toFixed(2);}),itemStyle:{color:new echarts.graphic.LinearGradient(1,0,0,0,[{offset:0,color:'#8b5cf6'},{offset:1,color:'#c4b5fd'}]),borderRadius:[0,4,4,0]},barMaxWidth:22,label:{show:true,position:'right',formatter:'¥{c}',color:'#6b7280',fontSize:10}}]});
  t3RenderTransportSummary(data);
  t3RenderProviders(data);
  t3RenderChannelTable(data);
  t3RenderBoxBasic(data);
  t3RenderBoxCross(data);
  if(t3BoxView==='cost'){t3RenderBoxCost();}
  t3RenderInsights(data);
  t3RenderDetail();
}
// ============ Tab3 运输类型总览 ============（对齐旧版：件数/箱数/计费重/费用=priced，物流商/渠道=全部）
function t3RenderTransportSummary(data){
  var html=t3Types.map(function(t){
    var sub=data.filter(function(d){return d['运输类型']===t;});
    if(!sub.length)return '';
    var subPriced=sub.filter(t3IsPriced);
    var vol=subPriced.reduce(function(s,d){return s+t3CalcVolWeight(d);},0);
    var fee=subPriced.reduce(function(s,d){return s+t3CalcFee(d);},0);
    var avg=vol>0?(fee/vol):0;
    // 对齐旧版：件数/箱数=priced记录
    var qty=subPriced.reduce(function(s,d){return s+t3Num(d['件数']);},0);
    var box=subPriced.reduce(function(s,d){return s+t3Num(d['箱数确认']);},0);
    var pricedQty=qty;
    var provCount={};sub.forEach(function(d){if(d['物流商'])provCount[d['物流商']]=1;});
    var chanCount={};sub.forEach(function(d){if(d['物流渠道'])chanCount[d['物流渠道']]=1;});
    var totalCost=subPriced.reduce(function(s,d){return s+t3CalcTotalCost(d);},0);
    var totalFreight=subPriced.reduce(function(s,d){return s+t3Num(d['运费']);},0);
    var totalInsurance=subPriced.reduce(function(s,d){return s+t3Num(d['保险费']);},0);
    var totalCustoms=subPriced.reduce(function(s,d){return s+t3Num(d['报关费']);},0);
    var totalTariff=subPriced.reduce(function(s,d){return s+t3Num(d['关税']);},0);
    var avgPerPiece=pricedQty>0?(totalCost/pricedQty):0;
    return '<div class="transport-card" style="border-top-color:'+t3Colors[t]+'"><div class="tc-head"><span class="icon">'+t3Icons[t]+'</span><span class="name">'+escapeHtml(t)+'</span><span class="avg" style="color:'+t3Colors[t]+'">¥'+t3Fmt(avg,2)+'<span style="font-size:11px;color:#999;margin-left:6px">| 按件:¥'+t3Fmt(avgPerPiece,2)+'</span></span></div><div class="tc-stats"><div class="tc-stat"><div class="v">'+t3Fmt(qty,0)+'</div><div class="l">件数</div></div><div class="tc-stat"><div class="v">'+t3Fmt(box,0)+'</div><div class="l">箱数</div></div><div class="tc-stat"><div class="v">'+t3Fmt(vol,0)+'</div><div class="l">计费重</div></div><div class="tc-stat"><div class="v">'+t3Fmt(totalCost,0)+'</div><div class="l">总运费</div></div><div class="tc-stat"><div class="v">¥'+t3Fmt(totalFreight,0)+'</div><div class="l">运费</div></div><div class="tc-stat"><div class="v">¥'+t3Fmt(totalInsurance,0)+'</div><div class="l">保险费</div></div><div class="tc-stat"><div class="v">¥'+t3Fmt(totalCustoms,0)+'</div><div class="l">报关费</div></div><div class="tc-stat"><div class="v">¥'+t3Fmt(totalTariff,0)+'</div><div class="l">关税</div></div><div class="tc-stat"><div class="v">'+Object.keys(provCount).length+'</div><div class="l">物流商</div></div><div class="tc-stat"><div class="v">'+Object.keys(chanCount).length+'</div><div class="l">渠道数</div></div></div></div>';
  }).join('');
  document.getElementById('t3-transportGrid').innerHTML=html||'<div class="empty">无数据</div>';
}
// ============ Tab3 渠道决策洞察 ============
function t3RenderInsights(data){
  var groups={};
  data.forEach(function(d){var key=d['物流商']+'__'+d['运输类型'];if(!groups[key])groups[key]=[];groups[key].push(d);});
  var arr=Object.keys(groups).map(function(key){
    var parts=key.split('__');var prov=parts[0],t=parts[1];
    var recs=groups[key];
    var priced=recs.filter(t3IsPriced);
    var vol=priced.reduce(function(s,d){return s+t3CalcVolWeight(d);},0);
    var fee=priced.reduce(function(s,d){return s+t3CalcFee(d);},0);
    var avg=vol>0?(fee/vol):null;
    var qty=recs.reduce(function(s,d){return s+t3Num(d['件数']);},0);
    var prices=recs.filter(function(d){return parsePrice(d['单价'])!==null;}).map(function(d){return parsePrice(d['单价']);});
    var pstd=prices.length>1?t3StdDev(prices):0;
    var tset={};recs.forEach(function(d){var nums=String(d['时效要求']).match(/\d+/g);if(nums)nums.forEach(function(n){tset[n]=1;});});
    var tnums=Object.keys(tset).map(function(n){return parseInt(n);});
    var avgT=tnums.length?tnums.reduce(function(a,b){return a+b;},0)/tnums.length:null;
    return {prov:prov,t:t,avg:avg,qty:qty,vol:vol,pstd:pstd,avgT:avgT,records:recs.length};
  }).filter(function(x){return x.avg!==null;});
  var insights=[];
  t3Types.forEach(function(t){
    var subs=arr.filter(function(x){return x.t===t;});
    if(!subs.length)return;
    var cheapest=subs.reduce(function(a,b){return a.avg<b.avg?a:b;});
    var largest=subs.reduce(function(a,b){return a.qty>b.qty?a:b;});
    if(cheapest.qty>=100){
      insights.push({cls:'good',title:t3Icons[t]+' '+t+'最低价渠道: '+cheapest.prov,text:'均价 ¥'+t3Fmt(cheapest.avg,2)+', 发货 '+t3Fmt(cheapest.qty,0)+'件, 时效 '+(cheapest.avgT!==null?t3Fmt(cheapest.avgT,0):'-')+'天'});
    }
    if(largest.prov!==cheapest.prov&&largest.qty>cheapest.qty*2){
      insights.push({cls:'info',title:t3Icons[t]+' '+t+'主力渠道: '+largest.prov,text:'发货量最大 '+t3Fmt(largest.qty,0)+'件, 均价 ¥'+t3Fmt(largest.avg,2)+', 适合主力配置'});
    }
  });
  arr.filter(function(x){return x.avg&&x.pstd/x.avg>0.15&&x.qty>200;}).forEach(function(x){
    insights.push({cls:'warn',title:'⚠ '+x.prov+' ('+x.t+') 价格波动较大',text:'均价 ¥'+t3Fmt(x.avg,2)+', 波动 ±'+t3Fmt(x.pstd,2)+' ('+t3Fmt(x.pstd/x.avg*100,0)+'%), 建议关注报价稳定性'});
  });
  var fast=arr.filter(function(x){return x.avgT!==null&&x.qty>=200;}).sort(function(a,b){return a.avgT-b.avgT;})[0];
  if(fast){
    insights.push({cls:'good',title:'⚡ 时效最快: '+fast.prov+' ('+fast.t+')',text:'平均时效 '+t3Fmt(fast.avgT,0)+'天, 均价 ¥'+t3Fmt(fast.avg,2)+', 适合紧急补货'});
  }
  var costEff=arr.filter(function(x){return x.qty>=1000;}).sort(function(a,b){return a.avg-b.avg;});
  if(costEff.length>=2){
    var best=costEff[0];
    insights.push({cls:'good',title:'💎 性价比之选: '+best.prov+' ('+best.t+')',text:'发货量 '+t3Fmt(best.qty,0)+'件 中价格最低 (¥'+t3Fmt(best.avg,2)+'), 大批量发货首选'});
  }
  var small=arr.filter(function(x){return x.qty<500&&x.qty>=50;});
  if(small.length){
    insights.push({cls:'info',title:'ℹ 备选小渠道 ('+small.length+'个)',text:small.slice(0,3).map(function(x){return x.prov;}).join('、')+' 等发货量较小, 可作为补充或试单渠道'});
  }
  var html=insights.map(function(i){return '<div class="insight-item '+i.cls+'"><div class="ii-title">'+escapeHtml(i.title)+'</div><div>'+escapeHtml(i.text)+'</div></div>';}).join('');
  document.getElementById('t3-insightList').innerHTML=html||'<div class="insight-item info">当前筛选数据不足, 无法生成洞察</div>';
}
// ============ Tab3 物流商卡片视图 ============
function t3RenderProviders(data){
  var groups={};
  data.forEach(function(d){var key=d['物流商']+'__'+d['运输类型'];if(!groups[key])groups[key]=[];groups[key].push(d);});
  var cards=Object.keys(groups).map(function(key){var recs=groups[key];var qty=recs.reduce(function(s,d){return s+t3Num(d['件数']);},0);return {key:key,recs:recs,qty:qty};}).sort(function(a,b){return b.qty-a.qty;});
  var html=cards.map(function(c){return t3BuildProviderCard(c.key,c.recs);}).join('');
  document.getElementById('t3-providerGrid').innerHTML=html||'<div class="empty">当前筛选无数据</div>';
}
function t3BuildProviderCard(key,recs){
  var parts=key.split('__');var prov=parts[0],t=parts[1];
  var color=t3Colors[t]||'#7c3aed';var icon=t3Icons[t]||'📦';
  var records=recs.length;
  var priced=recs.filter(t3IsPriced);
  // 件数/箱数=全部记录（原版逻辑）
  var qty=recs.reduce(function(s,d){return s+t3Num(d['件数']);},0);
  var box=recs.reduce(function(s,d){return s+t3Num(d['箱数确认']);},0);
  var pricedQty=priced.reduce(function(s,d){return s+t3Num(d['件数']);},0);
  var vol=priced.reduce(function(s,d){return s+t3CalcVolWeight(d);},0);
  var fee=priced.reduce(function(s,d){return s+t3CalcFee(d);},0);
  var avg=vol>0?(fee/vol):null;
  var totalCost=priced.reduce(function(s,d){return s+t3CalcTotalCost(d);},0);
  var totalFreight=priced.reduce(function(s,d){return s+t3Num(d['运费']);},0);
  var totalInsurance=priced.reduce(function(s,d){return s+t3Num(d['保险费']);},0);
  var totalCustoms=priced.reduce(function(s,d){return s+t3Num(d['报关费']);},0);
  var totalTariff=priced.reduce(function(s,d){return s+t3Num(d['关税']);},0);
  var avgPerPiece=pricedQty>0?(totalCost/pricedQty):0;
  var prices=priced.map(function(d){return parsePrice(d['单价']);}).filter(function(p){return p!==null;});
  var pmin=prices.length?Math.min.apply(null,prices):null;
  var pmax=prices.length?Math.max.apply(null,prices):null;
  var pstd=prices.length>1?t3StdDev(prices):0;
  var tset={};recs.forEach(function(d){var nums=String(d['时效要求']).match(/\d+/g);if(nums)nums.forEach(function(n){tset[n]=1;});});
  var tarr=Object.keys(tset).map(function(n){return parseInt(n);}).sort(function(a,b){return a-b;});
  var channels={};recs.forEach(function(d){if(d['物流渠道'])channels[d['物流渠道']]=1;});
  var channelCount=Object.keys(channels).length;
  var bgRate=recs.length?recs.filter(function(d){return d['是否报关']==='是';}).length/recs.length*100:0;
  // 产品数=一级分类（原版逻辑，不是品名）
  var prods={};recs.forEach(function(d){if(d['一级分类'])prods[d['一级分类']]=1;});
  var prodCount=Object.keys(prods).length;
  var decision='',dCls='info';
  if(avg!==null&&tarr.length){
    var avgT=tarr.reduce(function(a,b){return a+b;},0)/tarr.length;
    if(qty>=5000&&pstd/avg<0.1){decision='✓ 主力渠道: 发货量大且价格稳定, 建议优先配置';dCls='recommend';}
    else if(qty>=1000&&avgT<=7){decision='✓ 高效渠道: 时效快, 适合紧急补货';dCls='recommend';}
    else if(pstd/avg>0.2){decision='⚠ 价格波动大, 需关注报价稳定性';dCls='warn';}
    else if(qty<200){decision='ℹ 发货量较少, 可作为备选渠道';dCls='info';}
    else {decision='ℹ 综合渠道, 按需配置';dCls='info';}
  }else{decision='ℹ 单价数据缺失, 仅可看发货量';dCls='info';}
  var ek=escapeAttr(key);
  var productsHtml=t3BuildProductRows(prov,t,recs);
  return '<div class="provider-card" style="border-left:5px solid '+color+';background:#fff;cursor:pointer" data-key="'+ek+'" onclick="t3ShowProviderDetail(\''+t3EscS(key)+'\')">'+
    '<div class="pc-head" onclick="event.stopPropagation();t3ToggleProvider(\''+t3EscS(key)+'\')">'+
      '<span class="icon">'+icon+'</span>'+
      '<span class="name">'+escapeHtml(prov)+'</span>'+
      '<span class="type-tag" style="background:'+color+'">'+escapeHtml(t)+'</span>'+
      '<span class="expand-icon">▼</span>'+
    '</div>'+
    '<div class="pc-metrics">'+
      '<div class="pc-metric price"><div class="v">'+(avg!==null?'¥'+t3Fmt(avg,2):'-')+'</div><div class="l">均价</div></div>'+
      '<div class="pc-metric price"><div class="v">¥'+t3Fmt(avgPerPiece,2)+'</div><div class="l">按件均价</div></div>'+
      '<div class="pc-metric"><div class="v">'+t3Fmt(qty,0)+'</div><div class="l">件数</div></div>'+
      '<div class="pc-metric"><div class="v">'+t3Fmt(box,0)+'</div><div class="l">箱数</div></div>'+
      '<div class="pc-metric"><div class="v">'+t3Fmt(vol,0)+'</div><div class="l">计费重</div></div>'+
      '<div class="pc-metric"><div class="v">'+records+'</div><div class="l">记录数</div></div>'+
      '<div class="pc-metric"><div class="v">'+(pmin!==null?'¥'+t3Fmt(pmin,2):'-')+'</div><div class="l">最低价</div></div>'+
      '<div class="pc-metric"><div class="v">'+(pmax!==null?'¥'+t3Fmt(pmax,2):'-')+'</div><div class="l">最高价</div></div>'+
    '</div>'+
    '<div class="pc-cost-row">'+
      '<span class="cost-item"><span class="cost-l">运费</span><span class="cost-v">¥'+t3Fmt(totalFreight,0)+'</span></span>'+
      '<span class="cost-item"><span class="cost-l">保险费</span><span class="cost-v">¥'+t3Fmt(totalInsurance,0)+'</span></span>'+
      '<span class="cost-item"><span class="cost-l">报关费</span><span class="cost-v">¥'+t3Fmt(totalCustoms,0)+'</span></span>'+
      '<span class="cost-item"><span class="cost-l">关税</span><span class="cost-v">¥'+t3Fmt(totalTariff,0)+'</span></span>'+
      '<span class="cost-item total"><span class="cost-l">总运费</span><span class="cost-v">¥'+t3Fmt(totalCost,0)+'</span></span>'+
    '</div>'+
    '<div class="pc-meta">'+
      '<span class="chip">⏱ 时效: '+(tarr.length?tarr.join('/'):'-')+'天</span>'+
      '<span class="chip">📊 波动: '+(pstd>0&&avg?'±'+t3Fmt(pstd,2):'-')+'</span>'+
      '<span class="chip">🛃 报关率: '+t3Fmt(bgRate,0)+'%</span>'+
      '<span class="chip">📋 产品(一级): '+prodCount+'</span>'+
      '<span class="chip">🔗 渠道数: '+channelCount+'</span>'+
    '</div>'+
    '<div class="pc-decision '+dCls+'">'+escapeHtml(decision)+'</div>'+
    '<div class="pc-detail">'+
      '<div class="pc-detail-title">📋 细分一级分类发货明细 (点击行查看详细记录)</div>'+
      '<div class="product-row header"><div>产品(一级分类)</div><div>件数</div><div>箱数</div><div>计费重</div><div>均价</div><div>总运费</div><div></div></div>'+
      productsHtml+
    '</div>'+
  '</div>';
}
// 按一级分类分组（原版逻辑，不是品名）
function t3BuildProductRows(prov,t,recs){
  var pg={};recs.forEach(function(d){var p=d['一级分类']||'未分类';if(!pg[p])pg[p]=[];pg[p].push(d);});
  var arr=Object.keys(pg).map(function(p){var rs=pg[p];var qty=rs.reduce(function(s,d){return s+t3Num(d['件数']);},0);var box=rs.reduce(function(s,d){return s+t3Num(d['箱数确认']);},0);var prc=rs.filter(t3IsPriced);var vol=prc.reduce(function(s,d){return s+t3CalcVolWeight(d);},0);var fee=prc.reduce(function(s,d){return s+t3CalcFee(d);},0);var avg=vol>0?(fee/vol):null;var totalCost=prc.reduce(function(s,d){return s+t3CalcTotalCost(d);},0);return {p:p,rs:rs,qty:qty,box:box,vol:vol,fee:fee,avg:avg,totalCost:totalCost};}).sort(function(a,b){return b.qty-a.qty;});
  return arr.map(function(pr){
    return '<div class="product-row" onclick="t3ShowProductDetail(\''+t3EscS(prov)+'\',\''+t3EscS(t)+'\',\''+t3EscS(pr.p)+'\')">'+
      '<div class="prod-name">'+escapeHtml(pr.p)+'</div>'+
      '<div>'+t3Fmt(pr.qty,0)+'</div>'+
      '<div>'+t3Fmt(pr.box,0)+'</div>'+
      '<div>'+t3Fmt(pr.vol,1)+'</div>'+
      '<div class="price">'+(pr.avg!==null?'¥'+t3Fmt(pr.avg,2):'-')+'</div>'+
      '<div style="font-size:11px;color:#888">¥'+t3Fmt(pr.totalCost,0)+'</div>'+
      '<div class="click-hint">查看'+pr.rs.length+'条 →</div>'+
    '</div>';
  }).join('');
}
function t3ToggleProvider(key){
  var card=document.querySelector('.provider-card[data-key="'+escapeAttr(key)+'"]');
  if(card)card.classList.toggle('expanded');
}
// ============ Provider Detail Modal (对齐旧版) ============
var t3ModalAllRecords=[];
function t3ShowProviderDetail(key){
  var parts=key.split('__');var prov=parts[0],t=parts[1];
  var recs=frData.filter(function(d){return d['物流商']===prov&&d['运输类型']===t&&t3FilterFr(d);});
  var priced=recs.filter(t3IsPriced);
  var vol=priced.reduce(function(s,d){return s+t3Num(d['计费重']);},0);
  var fee=priced.reduce(function(s,d){return s+t3Num(d['运费']);},0);
  var avg=vol>0?(fee/vol):null;
  var qty=priced.reduce(function(s,d){return s+t3Num(d['件数']);},0);
  var box=priced.reduce(function(s,d){return s+t3Num(d['箱数确认']);},0);
  var totalFreight=priced.reduce(function(s,d){return s+t3Num(d['运费']);},0);
  var totalInsurance=priced.reduce(function(s,d){return s+t3Num(d['保险费']);},0);
  var totalCustoms=priced.reduce(function(s,d){return s+t3Num(d['报关费']);},0);
  var totalTariff=priced.reduce(function(s,d){return s+t3Num(d['关税']);},0);
  var totalCost=priced.reduce(function(s,d){return s+t3Num(d['总金额']);},0);
  var avgPerPiece=qty>0?(totalCost/qty):0;
  var color=t3Colors[t]||'#7c3aed';
  var icon=t3Icons[t]||'📦';
  document.getElementById('t3-modalTitle').innerHTML=icon+' '+escapeHtml(prov)+' <span style="color:#888;font-size:14px">/ '+escapeHtml(t)+'</span>';
  var summary=[
    {v:recs.length,l:'记录数'},{v:t3Fmt(qty,0),l:'件数'},{v:t3Fmt(box,0),l:'箱数'},
    {v:t3Fmt(vol,1),l:'计费重(kg)'},{v:avg!==null?'¥'+t3Fmt(avg,2):'-',l:'均价'},
    {v:'¥'+t3Fmt(avgPerPiece,2),l:'按件均价'},{v:'¥'+t3Fmt(totalCost,0),l:'总运费'},
    {v:'¥'+t3Fmt(totalFreight,0),l:'运费'},{v:'¥'+t3Fmt(totalInsurance,0),l:'保险费'},
    {v:'¥'+t3Fmt(totalCustoms,0),l:'报关费'},{v:'¥'+t3Fmt(totalTariff,0),l:'关税'}
  ];
  document.getElementById('t3-modalSummary').innerHTML=summary.map(function(s){return '<div class="ms-item"><div class="v">'+s.v+'</div><div class="l">'+s.l+'</div></div>';}).join('');
  var cols=[
    {k:'入库单号',l:'单号'},{k:'提货日期',l:'提货日期'},{k:'物流渠道',l:'物流渠道'},
    {k:'发货团队',l:'发货团队'},{k:'发货地',l:'发货地'},{k:'目的地分类',l:'目的地分类'},
    {k:'时效要求',l:'时效'},{k:'是否报关',l:'报关'},{k:'件数',l:'件数'},
    {k:'箱数确认',l:'箱数'},{k:'计费重',l:'计费重'},{k:'单价',l:'单价(原始)'},
    {k:'运费',l:'运费'},{k:'保险费',l:'保险费'},{k:'报关费',l:'报关费'},
    {k:'关税',l:'关税'},{k:'总金额',l:'总运费'},{k:'一级分类',l:'一级分类'}
  ];
  document.getElementById('t3-modalHead').innerHTML=cols.map(function(c){return '<th>'+c.l+'</th>';}).join('');
  t3ModalAllRecords=recs.slice().sort(function(a,b){return a['提货日期']<b['提货日期']?1:-1;});
  document.getElementById('t3-providerModal').classList.add('show');
  t3RenderModalTable();
}
function t3RenderModalTable(){
  var keyword=(document.getElementById('t3-modalSearchInput')?.value||'').toLowerCase();
  var records=t3ModalAllRecords;
  if(keyword)records=records.filter(function(r){return String(r['入库单号']||'').toLowerCase().indexOf(keyword)!==-1;});
  var cols=[
    {k:'入库单号',l:'单号'},{k:'提货日期',l:'提货日期'},{k:'物流渠道',l:'物流渠道'},
    {k:'发货团队',l:'发货团队'},{k:'发货地',l:'发货地'},{k:'目的地分类',l:'目的地分类'},
    {k:'时效要求',l:'时效'},{k:'是否报关',l:'报关'},{k:'件数',l:'件数'},
    {k:'箱数确认',l:'箱数'},{k:'计费重',l:'计费重'},{k:'单价',l:'单价'},
    {k:'运费',l:'运费'},{k:'保险费',l:'保险费'},{k:'报关费',l:'报关费'},
    {k:'关税',l:'关税'},{k:'总金额',l:'总运费'},{k:'一级分类',l:'一级分类'}
  ];
  document.getElementById('t3-modalBody').innerHTML=records.map(function(r){
    return '<tr>'+
      '<td class="mono">'+escapeHtml(r['入库单号']||'-')+'</td>'+
      '<td>'+escapeHtml(r['提货日期']||'')+'</td>'+
      '<td><b>'+escapeHtml(r['物流渠道']||'')+'</b></td>'+
      '<td>'+escapeHtml(r['发货团队']||'')+'</td>'+
      '<td>'+escapeHtml(r['发货地']||'')+'</td>'+
      '<td>'+escapeHtml(r['目的地分类']||'')+'</td>'+
      '<td>'+escapeHtml(String(r['时效要求']||''))+'</td>'+
      '<td>'+(r['是否报关']==='是'?'<span class="tag-yes">是</span>':'<span class="tag-no">否</span>')+'</td>'+
      '<td>'+t3Fmt(t3Num(r['件数']),0)+'</td>'+
      '<td>'+t3Fmt(t3Num(r['箱数确认']),0)+'</td>'+
      '<td>'+t3Fmt(t3Num(r['计费重']),1)+'</td>'+
      '<td>'+escapeHtml(String(r['单价']||''))+'</td>'+
      '<td>'+t3Fmt(t3Num(r['运费']),0)+'</td>'+
      '<td>'+t3Fmt(t3Num(r['保险费']),0)+'</td>'+
      '<td>'+t3Fmt(t3Num(r['报关费']),0)+'</td>'+
      '<td>'+t3Fmt(t3Num(r['关税']),0)+'</td>'+
      '<td>'+t3Fmt(t3Num(r['总金额']),0)+'</td>'+
      '<td>'+escapeHtml(r['一级分类']||'')+'</td>'+
    '</tr>';
  }).join('')||'<tr><td colspan="18" style="text-align:center;color:#999;padding:20px">无数据</td></tr>';
}
function t3CloseProviderModal(){
  document.getElementById('t3-providerModal').classList.remove('show');
  document.getElementById('t3-modalSearchInput').value='';
}
function t3ShowProductDetail(prov,t,prod){
  // 按一级分类筛选（原版逻辑，不是品名）
  var recs=frData.filter(function(d){return d['物流商']===prov&&d['运输类型']===t&&(d['一级分类']||'未分类')===prod&&t3FilterFr(d);});
  var priced=recs.filter(t3IsPriced);
  var vol=priced.reduce(function(s,d){return s+t3CalcVolWeight(d);},0);
  var fee=priced.reduce(function(s,d){return s+t3CalcFee(d);},0);
  var avg=vol>0?(fee/vol):null;
  var qty=recs.reduce(function(s,d){return s+t3Num(d['件数']);},0);
  var box=recs.reduce(function(s,d){return s+t3Num(d['箱数确认']);},0);
  var totalCost=priced.reduce(function(s,d){return s+t3CalcTotalCost(d);},0);
  var summary=[
    {v:recs.length,l:'记录数'},{v:t3Fmt(qty,0),l:'件数'},{v:t3Fmt(box,0),l:'箱数'},{v:t3Fmt(vol,1),l:'计费重(kg)'},
    {v:avg!==null?'¥'+t3Fmt(avg,2):'-',l:'均价'},{v:'¥'+t3Fmt(totalCost,0),l:'总运费'}
  ];
  var allRecs=[].concat(recs).sort(function(a,b){var da=String(a['提货日期']),db=String(b['提货日期']);return da<db?1:(da>db?-1:0);});
  var cols=[{k:'入库单号',l:'单号'},{k:'提货日期',l:'提货日期'},{k:'物流渠道',l:'物流渠道'},{k:'发货团队',l:'发货团队'},{k:'发货地',l:'发货地'},{k:'目的地',l:'目的地'},{k:'目的地分类',l:'目的地分类'},{k:'时效要求',l:'时效'},{k:'是否报关',l:'报关'},{k:'件数',l:'件数'},{k:'箱数确认',l:'箱数'},{k:'体积重',l:'计费重'},{k:'单价',l:'单价(原始)'},{k:'单价解析',l:'单价(解析)'},{k:'运费',l:'运费'},{k:'保险费',l:'保险费'},{k:'报关费',l:'报关费'},{k:'关税',l:'关税'},{k:'总运费',l:'总运费'},{k:'一级分类',l:'一级分类'}];
  function renderRows(kw){
    var disp=allRecs;
    if(kw){kw=kw.toLowerCase();disp=allRecs.filter(function(r){return String(r['入库单号']||'').toLowerCase().indexOf(kw)!==-1;});}
    return disp.map(function(r){
      var pp=parsePrice(r['单价']);
      return '<tr>'+
        '<td style="font-family:monospace;color:#6a1b9a">'+escapeHtml(r['入库单号']||'-')+'</td>'+
        '<td>'+escapeHtml(r['提货日期']||'-')+'</td>'+
        '<td><b>'+escapeHtml(r['物流渠道']||'-')+'</b></td>'+
        '<td>'+escapeHtml(r['发货团队']||'-')+'</td>'+
        '<td>'+escapeHtml(r['发货地']||'-')+'</td>'+
        '<td>'+escapeHtml(r['目的地']||'-')+'</td>'+
        '<td>'+escapeHtml(r['目的地分类']||'-')+'</td>'+
        '<td>'+escapeHtml(r['时效要求']||'-')+'</td>'+
        '<td>'+(r['是否报关']==='是'?'<span style="color:#e65100">是</span>':'否')+'</td>'+
        '<td>'+t3Fmt(t3Num(r['件数']),0)+'</td>'+
        '<td>'+t3Fmt(t3Num(r['箱数确认']),0)+'</td>'+
        '<td>'+t3Fmt(t3CalcVolWeight(r),2)+'</td>'+
        '<td>'+escapeHtml(r['单价']||'-')+'</td>'+
        '<td class="price-cell">'+(pp!==null?'¥'+t3Fmt(pp,2):'-')+'</td>'+
        '<td>¥'+t3Fmt(t3Num(r['运费']),2)+'</td>'+
        '<td>¥'+t3Fmt(t3Num(r['保险费']),2)+'</td>'+
        '<td>¥'+t3Fmt(t3Num(r['报关费']),2)+'</td>'+
        '<td>¥'+t3Fmt(t3Num(r['关税']),2)+'</td>'+
        '<td><b>¥'+t3Fmt(t3CalcTotalCost(r),2)+'</b></td>'+
        '<td style="max-width:200px;font-size:11px;color:#888">'+escapeHtml(r['一级分类']||'-')+'</td>'+
      '</tr>';
    }).join('')||'<tr><td colspan="20" style="text-align:center;padding:20px;color:#999">未找到匹配的记录</td></tr>';
  }
  var html='<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:14px">'+summary.map(function(s){return '<div class="kpi" style="padding:10px 8px"><div class="k-label" style="font-size:11px;margin-bottom:4px">'+s.l+'</div><div class="k-value" style="font-size:16px">'+s.v+'</div></div>';}).join('')+'</div>';
  html+='<div style="margin-bottom:10px"><input type="text" id="t3-prodSearch" placeholder="按入库单号搜索..." oninput="t3ProdSearchChange()" style="padding:8px 12px;border:1px solid #ddd6fe;border-radius:8px;width:320px;font-size:13px"></div>';
  html+='<div style="overflow-x:auto;max-height:50vh"><table style="width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap"><thead><tr style="background:#f5f3ff;position:sticky;top:0">'+cols.map(function(c){return '<th style="padding:8px;text-align:left;color:#4c1d95">'+c.l+'</th>';}).join('')+'</tr></thead><tbody id="t3-prodTbody">'+renderRows('')+'</tbody></table></div>';
  openModal(prov+' / '+t+' / '+prod,html);
  document.getElementById('modalTitle').innerHTML=icon+' '+escapeHtml(prov)+' <span style="color:#888;font-size:14px">/ '+escapeHtml(t)+' / '+escapeHtml(prod)+'</span>';
  window.t3ProdSearchChange=function(){var kw=document.getElementById('t3-prodSearch').value;document.getElementById('t3-prodTbody').innerHTML=renderRows(kw);};
}
// ============ Tab3 渠道对比表 ============
var t3ChannelSortKey='件数';
var t3ChannelSortDesc=true;
function t3SortChannel(k){
  if(t3ChannelSortKey===k)t3ChannelSortDesc=!t3ChannelSortDesc;
  else{t3ChannelSortKey=k;t3ChannelSortDesc=true;}
  t3RenderChannelTable(frData.filter(t3FilterFr));
}
function t3RenderChannelTable(data){
  var groups={};
  data.forEach(function(d){var key=d['物流渠道']+'__'+d['物流商']+'__'+d['运输类型'];if(!groups[key])groups[key]=[];groups[key].push(d);});
  var rows=Object.keys(groups).map(function(k){
    var parts=k.split('__');var chan=parts[0],prov=parts[1],t=parts[2];
    var recs=groups[k];
    var priced=recs.filter(t3IsPriced);
    var vol=priced.reduce(function(s,d){return s+t3CalcVolWeight(d);},0);
    var fee=priced.reduce(function(s,d){return s+t3CalcFee(d);},0);
    var avg=vol>0?(fee/vol):null;
    var prices=priced.map(function(d){return parsePrice(d['单价']);}).filter(function(p){return p!==null;});
    var pstd=prices.length>1?t3StdDev(prices):0;
    var tset={};recs.forEach(function(d){var nums=String(d['时效要求']).match(/\d+/g);if(nums)nums.forEach(function(n){tset[n]=1;});});
    var tarr=Object.keys(tset).map(function(n){return parseInt(n);}).sort(function(a,b){return a-b;});
    var totalCost=priced.reduce(function(s,d){return s+t3CalcTotalCost(d);},0);
    var totalFreight=priced.reduce(function(s,d){return s+t3Num(d['运费']);},0);
    var totalInsurance=priced.reduce(function(s,d){return s+t3Num(d['保险费']);},0);
    var totalCustoms=priced.reduce(function(s,d){return s+t3Num(d['报关费']);},0);
    var totalTariff=priced.reduce(function(s,d){return s+t3Num(d['关税']);},0);
    var destSet={};recs.forEach(function(d){if(d['目的地'])destSet[d['目的地']]=1;});
    // 产品数=一级分类（原版逻辑，不是品名）
    var prodSet={};recs.forEach(function(d){if(d['一级分类'])prodSet[d['一级分类']]=1;});
    var teamSet={};recs.forEach(function(d){if(d['发货团队'])teamSet[d['发货团队']]=1;});
    return {物流渠道:chan,物流商:prov,运输类型:t,color:t3Colors[t]||'#999',records:recs.length,件数:recs.reduce(function(s,d){return s+t3Num(d['件数']);},0),箱数:recs.reduce(function(s,d){return s+t3Num(d['箱数确认']);},0),体积重:vol,运费:totalFreight,保险费:totalInsurance,报关费:totalCustoms,关税:totalTariff,总运费:totalCost,均价:avg,最低价:prices.length?Math.min.apply(null,prices):null,最高价:prices.length?Math.max.apply(null,prices):null,价格波动:pstd,时效:tarr,目的地数:Object.keys(destSet).length,产品数:Object.keys(prodSet).length,团队数:Object.keys(teamSet).length};
  });
  rows.sort(function(a,b){var va=a[t3ChannelSortKey],vb=b[t3ChannelSortKey];if(va===null)va=-1;if(vb===null)vb=-1;if(typeof va==='string')return t3ChannelSortDesc?vb.localeCompare(va):va.localeCompare(vb);return t3ChannelSortDesc?vb-va:va-vb;});
  var cols=[{k:'物流渠道',l:'物流渠道'},{k:'物流商',l:'物流商'},{k:'运输类型',l:'类型'},{k:'均价',l:'均价(¥)'},{k:'最低价',l:'最低(¥)'},{k:'最高价',l:'最高(¥)'},{k:'价格波动',l:'波动'},{k:'件数',l:'件数'},{k:'箱数',l:'箱数'},{k:'体积重',l:'计费重'},{k:'运费',l:'运费(¥)'},{k:'保险费',l:'保险费(¥)'},{k:'报关费',l:'报关费(¥)'},{k:'关税',l:'关税(¥)'},{k:'总运费',l:'总运费(¥)'},{k:'records',l:'记录'},{k:'时效',l:'时效(天)'},{k:'目的地数',l:'目的地'},{k:'产品数',l:'产品(一级)'},{k:'团队数',l:'团队'}];
  document.querySelector('#t3-channelTable thead').innerHTML='<tr>'+cols.map(function(c){var ar=c.k===t3ChannelSortKey?(t3ChannelSortDesc?'▼':'▲'):'';return '<th onclick="t3SortChannel(\''+c.k+'\')" style="cursor:pointer">'+c.l+'<span class="arrow">'+ar+'</span></th>';}).join('')+'</tr>';
  document.querySelector('#t3-channelTable tbody').innerHTML=rows.map(function(r){
    return '<tr>'+
      '<td style="font-weight:600;color:#4c1d95">'+escapeHtml(r.物流渠道)+'</td>'+
      '<td>'+escapeHtml(r.物流商)+'</td>'+
      '<td><span class="type-pill" style="background:'+r.color+'">'+escapeHtml(r.运输类型)+'</span></td>'+
      '<td class="price-cell">'+(r.均价!==null?t3Fmt(r.均价,2):'<span class="muted">-</span>')+'</td>'+
      '<td>'+(r.最低价!==null?t3Fmt(r.最低价,2):'<span class="muted">-</span>')+'</td>'+
      '<td>'+(r.最高价!==null?t3Fmt(r.最高价,2):'<span class="muted">-</span>')+'</td>'+
      '<td>'+(r.价格波动>0?'±'+t3Fmt(r.价格波动,2):'<span class="muted">-</span>')+'</td>'+
      '<td>'+t3Fmt(r.件数,0)+'</td>'+
      '<td>'+t3Fmt(r.箱数,0)+'</td>'+
      '<td>'+t3Fmt(r.体积重,1)+'</td>'+
      '<td>'+t3Fmt(r.运费,0)+'</td>'+
      '<td>'+t3Fmt(r.保险费,0)+'</td>'+
      '<td>'+t3Fmt(r.报关费,0)+'</td>'+
      '<td>'+t3Fmt(r.关税,0)+'</td>'+
      '<td>'+t3Fmt(r.总运费,0)+'</td>'+
      '<td>'+r.records+'</td>'+
      '<td>'+(r.时效.length?r.时效.join('/'):'-')+'</td>'+
      '<td>'+r.目的地数+'</td>'+
      '<td>'+r.产品数+'</td>'+
      '<td>'+r.团队数+'</td>'+
    '</tr>';
  }).join('')||'<tr><td colspan="20" class="empty">无数据</td></tr>';
}
// ============ Tab3 盒型基础视图 ============
var t3BoxView='basic';
var t3BoxCache=null;
var t3BoxPalette=['#7c3aed','#667eea','#43cea2','#ff7675','#fdcb6e','#a29bfe','#00b894','#e17055','#74b9ff','#fab1a0','#81ecec','#55efc4','#ffeaa7','#fd79a8','#dfe6e9','#e84393','#00cec9'];
function t3RenderBoxBasic(data){
  var boxRecs=RAW.boxRecords||[];
  var shortMap=RAW.boxTypeShortMap||{};
  var filtered=boxRecs.filter(function(r){
    if(t3Filters['月份'].length&&t3Filters['月份'].indexOf(String(r['月份']))===-1)return false;
    if(t3Filters['运输类型'].length&&t3Filters['运输类型'].indexOf(r['运输类型'])===-1)return false;
    if(t3Filters['一级分类'].length&&t3Filters['一级分类'].indexOf(r['一级分类'])===-1)return false;
    if(t3Filters['发货团队'].length&&t3Filters['发货团队'].indexOf(r['发货团队'])===-1)return false;
    if(t3Filters['目的地分类'].length&&t3Filters['目的地分类'].indexOf(r['目的地分类'])===-1)return false;
    if(t3Filters['发货地'].length&&t3Filters['发货地'].indexOf(r['发货地'])===-1)return false;
    if(t3Filters['物流商'].length&&t3Filters['物流商'].indexOf(r['物流商'])===-1)return false;
    if(t3Filters['时效要求'].length&&t3Filters['时效要求'].indexOf(String(r['时效要求']))===-1)return false;
    if(t3Filters.dateStart&&r['提货日期']<t3Filters.dateStart)return false;
    if(t3Filters.dateEnd&&r['提货日期']>t3Filters.dateEnd)return false;
    return true;
  });
  var agg={};
  filtered.forEach(function(r){
    var b=r['盒型']||'未知';
    if(!agg[b])agg[b]={name:b,箱数:0,件数:0,物流商Set:{}};
    agg[b].箱数+=t3Num(r['箱数']);
    agg[b].件数+=t3Num(r['件数']);
    agg[b].物流商Set[r['物流商']]=1;
  });
  var valid=Object.keys(agg).map(function(k){
    return {name:agg[k].name,shortName:shortMap[agg[k].name]||agg[k].name,箱数:agg[k].箱数,件数:agg[k].件数,物流商数:Object.keys(agg[k].物流商Set).length};
  }).filter(function(d){return d.箱数>0||d.件数>0;}).sort(function(a,b){return b.箱数-a.箱数;});
  var totalBoxes=valid.reduce(function(s,d){return s+d.箱数;},0);
  var totalPieces=valid.reduce(function(s,d){return s+d.件数;},0);
  var colors=valid.map(function(_,i){return t3BoxPalette[i%t3BoxPalette.length];});
  t3BoxCache={valid:valid,totalBoxes:totalBoxes,totalPieces:totalPieces,colors:colors};
  // 渲染表格
  var tbody=document.querySelector('#t3-boxTable tbody');
  var thead=document.querySelector('#t3-boxTable thead');
  if(thead)thead.innerHTML='<tr><th>盒型(尺寸)</th><th>箱数</th><th>件数</th><th>箱数占比</th><th>件数占比</th><th>物流商数</th></tr>';
  if(tbody){
    tbody.innerHTML=valid.map(function(d,i){
      var boxPct=totalBoxes>0?(d.箱数/totalBoxes*100):0;
      var piecePct=totalPieces>0?(d.件数/totalPieces*100):0;
      var boxPctStr=boxPct.toFixed(2)+'%';
      var piecePctStr=piecePct.toFixed(2)+'%';
      return '<tr>'+
        '<td><strong>'+escapeHtml(d.shortName)+'</strong></td>'+
        '<td>'+t3Fmt(d.箱数,0)+'</td>'+
        '<td>'+t3Fmt(d.件数,0)+'</td>'+
        '<td><div class="pct-bar"><div class="pct-fill" style="width:'+boxPctStr+'"></div><span>'+boxPctStr+'</span></div></td>'+
        '<td>'+piecePctStr+'</td>'+
        '<td>'+d.物流商数+'</td>'+
      '</tr>';
    }).join('')||'<tr><td colspan="6" class="empty">无数据</td></tr>';
  }
  // 始终渲染图表（饼图/柱状图在盒型分析subtab里始终可见，跟子视图切换无关）
  t3RenderBoxCharts();
}
function t3RenderBoxCharts(){
  if(!t3BoxCache)return;
  var c=t3BoxCache;
  // 饼图：盒型箱数占比 (t3-c-boxcost)
  t3SetOption('t3-c-boxcost',{tooltip:{trigger:'item',formatter:function(p){var pct=c.totalBoxes>0?(p.value/c.totalBoxes*100).toFixed(1):0;return p.name+': '+t3Fmt(p.value,0)+' 箱 ('+pct+'%)';}},legend:{type:'scroll',orient:'vertical',right:5,top:'middle',textStyle:{fontSize:11,color:'#6b7280'}},series:[{type:'pie',radius:['38%','68%'],center:['38%','50%'],avoidLabelOverlap:true,itemStyle:{borderColor:'#fff',borderWidth:2},label:{show:false},emphasis:{label:{show:true,fontSize:14,fontWeight:'bold'}},data:c.valid.map(function(d,i){return {name:d.shortName,value:d.箱数,itemStyle:{color:c.colors[i]}};})}]},true);
  // 横向柱状图：盒型发货量排行 (t3-c-boxtype)
  var sorted=c.valid.slice().sort(function(a,b){return a.箱数-b.箱数;});
  t3SetOption('t3-c-boxtype',{tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(p){var v=p[0].value;var pct=c.totalBoxes>0?(v/c.totalBoxes*100).toFixed(1):0;return p[0].name+': '+t3Fmt(v,0)+' 箱 ('+pct+'%)';}},grid:{left:10,right:40,top:10,bottom:20,containLabel:true},xAxis:{type:'value',name:'箱数',axisLabel:{color:'#9ca3af'}},yAxis:{type:'category',data:sorted.map(function(d){return d.shortName;}),axisLabel:{color:'#6b7280',fontSize:11}},series:[{type:'bar',data:sorted.map(function(d,i){return {value:d.箱数,itemStyle:{color:c.colors[c.valid.indexOf(d)]}};}),barMaxWidth:22,label:{show:true,position:'right',formatter:function(p){return t3Fmt(p.value,0);},color:'#6b7280',fontSize:10},itemStyle:{borderRadius:[0,4,4,0]}}]},true);
}
function t3SwitchBoxView(viewType){
  t3BoxView=viewType;
  var basicView=document.getElementById('t3-boxBasicView');
  var deepView=document.getElementById('t3-boxDeepView');
  var costView=document.getElementById('t3-boxCostView');
  var basicBtn=document.getElementById('t3-boxBasicBtn');
  var deepBtn=document.getElementById('t3-boxDeepBtn');
  var costBtn=document.getElementById('t3-boxCostBtn');
  if(basicView)basicView.style.display=viewType==='basic'?'':'none';
  if(deepView)deepView.style.display=viewType==='deep'?'':'none';
  if(costView)costView.style.display=viewType==='cost'?'':'none';
  if(basicBtn)basicBtn.classList.toggle('active',viewType==='basic');
  if(deepBtn)deepBtn.classList.toggle('active',viewType==='deep');
  if(costBtn)costBtn.classList.toggle('active',viewType==='cost');
  if(viewType==='basic'){
    t3RenderBoxCharts();
    setTimeout(function(){if(allCharts['t3-c-boxcost'])allCharts['t3-c-boxcost'].resize();if(allCharts['t3-c-boxtype'])allCharts['t3-c-boxtype'].resize();},60);
  }
  if(viewType==='cost'){t3RenderBoxCost();}
}
// ============ Tab3 盒型费用分析（对齐旧版完整逻辑）============
function t3RenderBoxCost(){
  var costData=RAW.boxCostData||[];
  var shortMap=RAW.boxTypeShortMap||{};
  var el=document.getElementById('t3-boxCostTable');
  if(!costData.length){el.innerHTML='<div class="empty">无盒型费用数据</div>';return;}
  // 获取筛选后的boxRecords用于加权计算
  var boxRecords=RAW.boxRecords||[];
  var filteredBR=boxRecords.filter(function(r){
    if(t3Filters['月份'].length&&t3Filters['月份'].indexOf(String(r['月份']))===-1)return false;
    if(t3Filters['运输类型'].length&&t3Filters['运输类型'].indexOf(r['运输类型'])===-1)return false;
    if(t3Filters['一级分类'].length&&t3Filters['一级分类'].indexOf(r['一级分类'])===-1)return false;
    if(t3Filters['发货团队'].length&&t3Filters['发货团队'].indexOf(r['发货团队'])===-1)return false;
    if(t3Filters['目的地分类'].length&&t3Filters['目的地分类'].indexOf(r['目的地分类'])===-1)return false;
    if(t3Filters['发货地'].length&&t3Filters['发货地'].indexOf(r['发货地'])===-1)return false;
    if(t3Filters['物流商'].length&&t3Filters['物流商'].indexOf(r['物流商'])===-1)return false;
    if(t3Filters['时效要求'].length&&t3Filters['时效要求'].indexOf(String(r['时效要求']))===-1)return false;
    if(t3Filters.dateStart&&r['提货日期']<t3Filters.dateStart)return false;
    if(t3Filters.dateEnd&&r['提货日期']>t3Filters.dateEnd)return false;
    return true;
  });
  // 按盒型×运输类型统计件数（对齐旧版：空运拆分保税仓/直发，快递拆分168UPS/168aramex/普通）
  var boxTransportPieces={};
  filteredBR.forEach(function(r){
    if(!boxTransportPieces[r['盒型']])boxTransportPieces[r['盒型']]={空运保税仓:0,空运直发:0,海运:0,快递168UPS:0,快递168aramex:0,快递普通:0};
    var typeKey=r['运输类型'];
    if(typeKey==='空运'){
      var channel=r['物流渠道']||'';
      typeKey=channel.indexOf('保税仓')!==-1?'空运保税仓':'空运直发';
    }else if(typeKey==='快递'){
      var provider=(r['物流商']||'').toLowerCase();
      var origin=r['发货地']||'';
      if(origin==='168'&&provider.indexOf('ups')!==-1)typeKey='快递168UPS';
      else if(origin==='168'&&provider.indexOf('aramex')!==-1)typeKey='快递168aramex';
      else typeKey='快递普通';
    }
    if(boxTransportPieces[r['盒型']][typeKey]!==undefined)boxTransportPieces[r['盒型']][typeKey]+=t3Num(r['件数']);
  });
  // 计算每个盒型的加权均价
  var rows=costData.map(function(box){
    var pieces=boxTransportPieces[box['盒型']]||{空运保税仓:0,空运直发:0,海运:0,快递168UPS:0,快递168aramex:0,快递普通:0};
    var totalPieces=pieces.空运保税仓+pieces.空运直发+pieces.海运+pieces.快递168UPS+pieces.快递168aramex+pieces.快递普通;
    var weightedAvg=0;
    if(totalPieces>0){
      if(box['空运保税仓均价']!==null)weightedAvg+=box['空运保税仓均价']*(pieces.空运保税仓/totalPieces);
      if(box['空运直发均价']!==null)weightedAvg+=box['空运直发均价']*(pieces.空运直发/totalPieces);
      if(box['海运均价']!==null)weightedAvg+=box['海运均价']*(pieces.海运/totalPieces);
      if(box['快递168UPS均价']!==null)weightedAvg+=box['快递168UPS均价']*(pieces.快递168UPS/totalPieces);
      if(box['快递168aramex均价']!==null)weightedAvg+=box['快递168aramex均价']*(pieces.快递168aramex/totalPieces);
      if(box['快递普通均价']!==null)weightedAvg+=box['快递普通均价']*(pieces.快递普通/totalPieces);
    }
    return {box:box,pieces:pieces,totalPieces:totalPieces,weightedAvg:Math.round(weightedAvg*100)/100};
  });
  // 渲染两行表头+表体
  function fmtVal(v){return v!==null&&v!==undefined?'¥'+t3Fmt(v,2):'<span style="color:#ccc">-</span>';}
  var html='<div style="overflow-x:auto"><table class="data-table" style="width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap">';
  html+='<thead><tr style="background:#f5f3ff">';
  html+='<th rowspan="2" style="padding:8px 10px;color:#4c1d95">盒型</th>';
  html+='<th rowspan="2" style="padding:8px 10px;color:#4c1d95">尺寸</th>';
  html+='<th rowspan="2" style="padding:8px 10px;color:#4c1d95">计费重(KG)</th>';
  html+='<th rowspan="2" style="padding:8px 10px;color:#4c1d95">每箱件数</th>';
  html+='<th colspan="2" style="text-align:center;background:#e3f2fd;color:#1565c0;padding:6px 10px">空运(元/件)</th>';
  html+='<th rowspan="2" style="padding:8px 10px;color:#4c1d95">海运均价(元/件)</th>';
  html+='<th colspan="3" style="text-align:center;background:#ffebee;color:#c62828;padding:6px 10px">快递(元/件)</th>';
  html+='<th rowspan="2" style="padding:8px 10px;color:#5b21b6;font-weight:700">加权均价(元/件)</th>';
  html+='</tr><tr style="background:#f5f3ff">';
  html+='<th style="background:#e3f2fd;color:#1565c0;padding:6px 10px">保税仓</th>';
  html+='<th style="background:#e3f2fd;color:#1565c0;padding:6px 10px">直发</th>';
  html+='<th style="background:#ffebee;color:#c62828;padding:6px 10px">168UPS</th>';
  html+='<th style="background:#ffebee;color:#c62828;padding:6px 10px">168aramex</th>';
  html+='<th style="background:#ffebee;color:#c62828;padding:6px 10px">普通</th>';
  html+='</tr></thead><tbody>';
  rows.forEach(function(d,i){
    var bg=i%2?'#faf9fc':'#fff';
    var weightedStr=d.totalPieces>0?'¥'+t3Fmt(d.weightedAvg,2):'<span style="color:#ccc">无发货</span>';
    html+='<tr style="background:'+bg+';border-bottom:1px solid #f0ecfa">';
    html+='<td style="padding:6px 10px"><strong>'+escapeHtml(shortMap[d.box['盒型']]||d.box['盒型'])+'</strong></td>';
    html+='<td style="padding:6px 10px">'+escapeHtml(d.box['尺寸'])+'</td>';
    html+='<td style="padding:6px 10px">'+t3Fmt(d.box['计费重'],4)+'</td>';
    html+='<td style="padding:6px 10px">'+d.box['每箱件数']+'</td>';
    html+='<td style="padding:6px 10px;color:#1565c0;font-weight:600">'+fmtVal(d.box['空运保税仓均价'])+'</td>';
    html+='<td style="padding:6px 10px;color:#1565c0;font-weight:600">'+fmtVal(d.box['空运直发均价'])+'</td>';
    html+='<td style="padding:6px 10px">'+fmtVal(d.box['海运均价'])+'</td>';
    html+='<td style="padding:6px 10px;color:#c62828;font-weight:600">'+fmtVal(d.box['快递168UPS均价'])+'</td>';
    html+='<td style="padding:6px 10px;color:#c62828;font-weight:600">'+fmtVal(d.box['快递168aramex均价'])+'</td>';
    html+='<td style="padding:6px 10px;color:#c62828;font-weight:600">'+fmtVal(d.box['快递普通均价'])+'</td>';
    html+='<td style="padding:6px 10px;color:#6a1b9a;font-weight:bold">'+weightedStr+'</td>';
    html+='</tr>';
  });
  html+='</tbody>';
  // 底部汇总行
  var totalAB=0,totalAD=0,totalS=0,totalEU=0,totalEA=0,totalEN=0;
  var sumAB=0,sumAD=0,sumS=0,sumEU=0,sumEA=0,sumEN=0;
  rows.forEach(function(d){
    if(d.box['空运保税仓均价']!==null&&d.pieces.空运保税仓>0){sumAB+=d.box['空运保税仓均价']*d.pieces.空运保税仓;totalAB+=d.pieces.空运保税仓;}
    if(d.box['空运直发均价']!==null&&d.pieces.空运直发>0){sumAD+=d.box['空运直发均价']*d.pieces.空运直发;totalAD+=d.pieces.空运直发;}
    if(d.box['海运均价']!==null&&d.pieces.海运>0){sumS+=d.box['海运均价']*d.pieces.海运;totalS+=d.pieces.海运;}
    if(d.box['快递168UPS均价']!==null&&d.pieces.快递168UPS>0){sumEU+=d.box['快递168UPS均价']*d.pieces.快递168UPS;totalEU+=d.pieces.快递168UPS;}
    if(d.box['快递168aramex均价']!==null&&d.pieces.快递168aramex>0){sumEA+=d.box['快递168aramex均价']*d.pieces.快递168aramex;totalEA+=d.pieces.快递168aramex;}
    if(d.box['快递普通均价']!==null&&d.pieces.快递普通>0){sumEN+=d.box['快递普通均价']*d.pieces.快递普通;totalEN+=d.pieces.快递普通;}
  });
  var r2=function(s,t){return t>0?'¥'+t3Fmt(s/t,2):'-';};
  html+='<tfoot style="font-weight:bold;background:#f8f5fb"><tr>';
  html+='<td colspan="4" style="text-align:right;padding:8px 10px;color:#4c1d95">运输类型加权均价 →</td>';
  html+='<td style="padding:8px 10px;color:#1565c0">'+r2(sumAB,totalAB)+'</td>';
  html+='<td style="padding:8px 10px;color:#1565c0">'+r2(sumAD,totalAD)+'</td>';
  html+='<td style="padding:8px 10px;color:#2ECC71">'+r2(sumS,totalS)+'</td>';
  html+='<td style="padding:8px 10px;color:#c62828">'+r2(sumEU,totalEU)+'</td>';
  html+='<td style="padding:8px 10px;color:#c62828">'+r2(sumEA,totalEA)+'</td>';
  html+='<td style="padding:8px 10px;color:#c62828">'+r2(sumEN,totalEN)+'</td>';
  html+='<td></td>';
  html+='</tr></tfoot></table></div>';
  el.innerHTML=html;
}
// ============ Tab3 盒型×渠道交叉分析（对齐旧版：分组/运输类型徽章/占比条）============
function t3RenderBoxCross(data){
  var boxRecs=RAW.boxRecords||[];
  var shortMap=RAW.boxTypeShortMap||{};
  var filtered=boxRecs.filter(function(r){
    if(t3Filters['月份'].length&&t3Filters['月份'].indexOf(String(r['月份']))===-1)return false;
    if(t3Filters['运输类型'].length&&t3Filters['运输类型'].indexOf(r['运输类型'])===-1)return false;
    if(t3Filters['一级分类'].length&&t3Filters['一级分类'].indexOf(r['一级分类'])===-1)return false;
    if(t3Filters['发货团队'].length&&t3Filters['发货团队'].indexOf(r['发货团队'])===-1)return false;
    if(t3Filters['目的地分类'].length&&t3Filters['目的地分类'].indexOf(r['目的地分类'])===-1)return false;
    if(t3Filters['发货地'].length&&t3Filters['发货地'].indexOf(r['发货地'])===-1)return false;
    if(t3Filters['物流商'].length&&t3Filters['物流商'].indexOf(r['物流商'])===-1)return false;
    if(t3Filters['时效要求'].length&&t3Filters['时效要求'].indexOf(String(r['时效要求']))===-1)return false;
    if(t3Filters.dateStart&&r['提货日期']<t3Filters.dateStart)return false;
    if(t3Filters.dateEnd&&r['提货日期']>t3Filters.dateEnd)return false;
    return true;
  });
  var agg={};
  filtered.forEach(function(r){
    var box=r['盒型']||'未知';var channel=r['物流渠道']||'未指定';var transport=r['运输类型']||'';
    var key=box+'||'+channel;
    if(!agg[key])agg[key]={盒型:box,短名:shortMap[box]||box,物流渠道:channel,运输类型:transport,箱数:0,件数:0};
    agg[key].箱数+=t3Num(r['箱数']);
    agg[key].件数+=t3Num(r['件数']);
  });
  var totalBoxes=filtered.reduce(function(s,r){return s+t3Num(r['箱数']);},0);
  var totalPieces=filtered.reduce(function(s,r){return s+t3Num(r['件数']);},0);
  var result=Object.values(agg).sort(function(a,b){
    if(a.盒型!==b.盒型)return a.盒型.localeCompare(b.盒型);
    return b.箱数-a.箱数;
  });
  var transportColors={'空运':'#3498DB','快递':'#E74C3C','海运':'#2ECC71'};
  var el=document.getElementById('t3-boxCross');
  if(!result.length){el.innerHTML='<div class="empty">暂无数据</div>';return;}
  var html='<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:10px 16px;margin-bottom:12px"><strong style="color:#856404">📌 深度分析说明：</strong><span style="color:#856404">按"盒型 × 物流渠道"交叉统计，展示每个盒子在各渠道的发货量占比</span></div>';
  html+='<div style="overflow-x:auto"><table class="data-table" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f5f3ff">';
  html+='<th style="padding:8px 10px;text-align:left;color:#4c1d95">盒型</th>';
  html+='<th style="padding:8px 10px;text-align:left;color:#4c1d95">物流渠道</th>';
  html+='<th style="padding:8px 10px;text-align:left;color:#4c1d95">运输类型</th>';
  html+='<th style="padding:8px 10px;text-align:left;color:#4c1d95">箱数</th>';
  html+='<th style="padding:8px 10px;text-align:left;color:#4c1d95">件数</th>';
  html+='<th style="padding:8px 10px;text-align:left;color:#4c1d95">箱数占比</th>';
  html+='<th style="padding:8px 10px;text-align:left;color:#4c1d95">件数占比</th>';
  html+='</tr></thead><tbody>';
  result.forEach(function(d,idx){
    var boxPct=totalBoxes>0?(d.箱数/totalBoxes*100).toFixed(2)+'%':'0%';
    var piecePct=totalPieces>0?(d.件数/totalPieces*100).toFixed(2)+'%':'0%';
    var prev=idx>0?result[idx-1]:null;
    var isFirstOfBox=!prev||prev.盒型!==d.盒型;
    var tColor=transportColors[d.运输类型]||'#999';
    html+='<tr'+(isFirstOfBox?' style="border-top:2px solid #6a1b9a"':'')+'>';
    html+='<td style="padding:6px 10px">'+(isFirstOfBox?'<strong>'+escapeHtml(d.短名)+'</strong>':'')+'</td>';
    html+='<td style="padding:6px 10px">'+escapeHtml(d.物流渠道)+'</td>';
    html+='<td style="padding:6px 10px"><span style="display:inline-block;padding:2px 8px;border-radius:4px;color:#fff;font-size:11px;background:'+tColor+'">'+escapeHtml(d.运输类型)+'</span></td>';
    html+='<td style="padding:6px 10px">'+t3Fmt(d.箱数,0)+'</td>';
    html+='<td style="padding:6px 10px">'+t3Fmt(d.件数,0)+'</td>';
    html+='<td style="padding:6px 10px"><div class="pct-bar"><div class="pct-fill" style="width:'+boxPct+'"></div><span>'+boxPct+'</span></div></td>';
    html+='<td style="padding:6px 10px">'+piecePct+'</td>';
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  el.innerHTML=html;
}
function t3OnSearch(){t3DetailState.search=document.getElementById('t3-searchInput').value;t3DetailState.page=1;t3RenderDetail();}
function t3SortBy(f){if(t3DetailState.sortField===f){t3DetailState.sortDir=t3DetailState.sortDir==='asc'?'desc':'asc';}else{t3DetailState.sortField=f;t3DetailState.sortDir='asc';}t3RenderDetail();}
function t3GoPage(p){t3DetailState.page=p;t3RenderDetail();}
function t3RenderDetail(){
  var s=t3DetailState.search.toLowerCase().trim();
  // 搜索字段：一级分类（不是品名）
  var filtered=frData.filter(function(d){if(s){var hay=(d['入库单号']+' '+(d['一级分类']||'')+' '+d['物流商']+' '+d['物流渠道']).toLowerCase();if(hay.indexOf(s)===-1)return false;}return t3FilterFr(d);});
  var sf=t3DetailState.sortField,dir=t3DetailState.sortDir==='asc'?1:-1;
  filtered.sort(function(a,b){var x,y;if(sf==='总金额'){x=t3CalcTotalCost(a);y=t3CalcTotalCost(b);}else if(sf==='体积重'){x=t3CalcVolWeight(a);y=t3CalcVolWeight(b);}else{x=t3Num(a[sf]),y=t3Num(b[sf]);}return(x-y)*dir;});
  var colLabels={'入库单号':'入库单号','一级分类':'一级分类','物流商':'物流商','物流渠道':'物流渠道','运输类型':'运输类型','时效要求':'时效','发货地':'发货地','目的地':'目的地','件数':'件数','箱数确认':'箱数','体积重':'体积重','单价':'单价','总金额':'总运费(估)'};
  var cols=['入库单号','一级分类','物流商','物流渠道','运输类型','时效要求','发货地','目的地','件数','箱数确认','体积重','单价','总金额'];
  document.querySelector('#t3-detailTable thead').innerHTML='<tr>'+cols.map(function(c){var ar=t3DetailState.sortField===c?(t3DetailState.sortDir==='asc'?'▲':'▼'):'';return '<th onclick="t3SortBy(\''+c+'\')" style="cursor:pointer">'+(colLabels[c]||c)+'<span class="arrow">'+ar+'</span></th>';}).join('')+'</tr>';
  var total=filtered.length,pages=Math.ceil(total/t3DetailState.pageSize)||1;if(t3DetailState.page>pages)t3DetailState.page=1;
  var start=(t3DetailState.page-1)*t3DetailState.pageSize,pd=filtered.slice(start,start+t3DetailState.pageSize);
  document.querySelector('#t3-detailTable tbody').innerHTML=pd.map(function(d){return '<tr><td style="font-family:monospace;color:#4c1d95">'+escapeHtml(d['入库单号']||'')+'</td><td style="max-width:180px">'+escapeHtml(d['一级分类']||'')+'</td><td style="font-weight:600;color:#4c1d95">'+escapeHtml(d['物流商']||'')+'</td><td>'+escapeHtml(d['物流渠道']||'')+'</td><td>'+escapeHtml(d['运输类型']||'')+'</td><td>'+escapeHtml(d['时效要求']||'')+'</td><td>'+escapeHtml(d['发货地']||'')+'</td><td>'+escapeHtml(d['目的地']||'')+'</td><td>'+t3Fmt(t3Num(d['件数']),0)+'</td><td>'+t3Fmt(t3Num(d['箱数确认']),0)+'</td><td>'+t3Fmt(t3CalcVolWeight(d),1)+'</td><td>'+escapeHtml(d['单价']||'')+'</td><td style="font-weight:700;color:#667eea">¥'+t3Fmt(t3CalcTotalCost(d),2)+'</td></tr>';}).join('')||'<tr><td colspan="13" class="empty">无匹配数据</td></tr>';
  document.getElementById('t3-detailCount').textContent='共 '+total.toLocaleString()+' 条';
  document.getElementById('t3-pager').innerHTML='<button onclick="t3GoPage(1)" '+(t3DetailState.page<=1?'disabled':'')+'>首页</button><button onclick="t3GoPage('+(t3DetailState.page-1)+')" '+(t3DetailState.page<=1?'disabled':'')+'>上一页</button><span class="info">第 '+t3DetailState.page+' / '+pages+' 页</span><button onclick="t3GoPage('+(t3DetailState.page+1)+')" '+(t3DetailState.page>=pages?'disabled':'')+'>下一页</button><button onclick="t3GoPage('+pages+')" '+(t3DetailState.page>=pages?'disabled':'')+'>末页</button><span class="info">每页 '+t3DetailState.pageSize+' 条</span>';
}
function t3Export(){
  var data=frData.filter(t3FilterFr);
  var colLabels={'入库单号':'入库单号','一级分类':'一级分类','物流商':'物流商','物流渠道':'物流渠道','运输类型':'运输类型','时效要求':'时效要求','发货地':'发货地','目的地':'目的地','件数':'件数','箱数确认':'箱数','体积重':'体积重','单价':'单价','总金额':'总运费(估)'};
  var cols=['入库单号','一级分类','物流商','物流渠道','运输类型','时效要求','发货地','目的地','件数','箱数确认','体积重','单价','总金额'];
  var csv='\uFEFF'+cols.map(function(c){return colLabels[c]||c;}).join(',')+'\n';
  data.forEach(function(d){csv+=cols.map(function(c){var v;if(c==='体积重')v=t3CalcVolWeight(d).toFixed(2);else if(c==='总金额')v=t3CalcTotalCost(d).toFixed(2);else v=String(d[c]||'').replace(/"/g,'""');return '"'+v+'"';}).join(',')+'\n';});
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='大货运费明细_'+new Date().toLocaleDateString().replace(/\//g,'')+'.csv';a.click();
}

// ============================================================
// Tab4: 供应商评级
// ============================================================
var T4_WEIGHTS = { '时效':0.35, '成本':0.25, '服务':0.15, '稳定性':0.10, '异常':0.10 };
var T4_DIM_FULL = 100;
var t4Filters = { timeMode:'month', selectedMonths:[], selectedQuarters:[], transport:[], startDate:'', endDate:'' };
var t4Mselects = {};
var t4SortState = { key:'totalScore', desc:true };

// 服务打分存储（localStorage）
function t4GetServiceScores(){
  try { return JSON.parse(localStorage.getItem('t4_service_scores')||'{}'); }
  catch(e){ return {}; }
}
function t4SaveServiceScores(s){
  try { localStorage.setItem('t4_service_scores', JSON.stringify(s)); } catch(e){}
}
function t4GetServiceScore(carrier, month){
  var s = t4GetServiceScores();
  var key = carrier+'|'+month;
  return s[key] || 0;
}
function t4SetServiceScore(carrier, month, stars){
  var s = t4GetServiceScores();
  var key = carrier+'|'+month;
  if(stars > 0) s[key] = stars;
  else delete s[key];
  t4SaveServiceScores(s);
}

// 初始化筛选器
function t4InitFilters(){
  // 月份多选
  var allMonths = uniqueVals(t2BoxData, '收件年份').map(function(y){
    return uniqueVals(t2BoxData, '收件月份').map(function(m){
      return y+'-'+String(m).padStart(2,'0');
    });
  }).flat().filter(function(m){ return m && m !== '-' && !m.startsWith('nan'); }).sort();
  // 也可以从提货时间提取
  if(allMonths.length === 0){
    var mSet = {};
    t2BoxData.forEach(function(d){
      var dt = parseDate(d['提货时间']);
      if(dt){ var k = dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0'); mSet[k]=1; }
    });
    allMonths = Object.keys(mSet).sort();
  }
  t4Mselects['months'] = initMselect('t4-monthPicker','月份',allMonths,t4Filters,function(){ t4Filters.selectedMonths = t4Filters['月份']; t4Render(); });
  t4Filters.selectedMonths = [];

  // 季度多选
  var quarters = [];
  var ySet = {};
  allMonths.forEach(function(m){
    var parts = m.split('-');
    var y = parts[0], mo = parseInt(parts[1]);
    var q = 'Q'+Math.ceil(mo/3);
    var qk = y+'-'+q;
    ySet[qk] = 1;
  });
  quarters = Object.keys(ySet).sort();
  t4Mselects['quarters'] = initMselect('t4-quarterPicker','季度',quarters,t4Filters,function(){ t4Filters.selectedQuarters = t4Filters['季度']; t4Render(); });
  t4Filters.selectedQuarters = [];

  // 运输类型
  var transports = uniqueVals(t2BoxData, '运输类型').filter(function(t){ return t && t !== 'nan'; });
  t4Mselects['transport'] = initMselect('t4-f-transport','运输类型',transports,t4Filters,function(){ t4Filters.transport = t4Filters['运输类型']; t4Render(); });
  t4Filters.transport = [];

  // 发货仓库
  var origins = uniqueVals(t2BoxData, '发货仓库').filter(function(v){ return v && v !== 'nan'; });
  t4Mselects['origin'] = initMselect('t4-f-origin','发货仓库',origins,t4Filters,function(){ t4Filters.origin = t4Filters['发货仓库']; t4Render(); });
  t4Filters.origin = [];

  // 目的仓库
  var dests = uniqueVals(t2BoxData, '目的仓库').filter(function(v){ return v && v !== 'nan'; });
  t4Mselects['dest'] = initMselect('t4-f-dest','目的仓库',dests,t4Filters,function(){ t4Filters.dest = t4Filters['目的仓库']; t4Render(); });
  t4Filters.dest = [];
}

function t4SwitchTimeMode(mode, evt){
  t4Filters.timeMode = mode;
  document.querySelectorAll('#t4-timeMode .src-tab').forEach(function(t){ t.classList.remove('active'); });
  var btn = (evt && evt.target) ? evt.target : document.querySelector('#t4-timeMode .src-tab[onclick*="'+mode+'"]');
  if(btn) btn.classList.add('active');
  document.getElementById('t4-monthPicker').style.display = (mode==='month') ? '' : 'none';
  document.getElementById('t4-quarterPicker').style.display = (mode==='quarter') ? '' : 'none';
  document.getElementById('t4-customPicker').style.display = (mode==='custom') ? 'flex' : 'none';
  t4Render();
}

function t4Reset(){
  for(var k in t4Mselects){ t4Mselects[k].reset(); }
  t4Filters.selectedMonths = [];
  t4Filters.selectedQuarters = [];
  t4Filters.transport = [];
  t4Filters.origin = [];
  t4Filters.dest = [];
  t4Filters.startDate = '';
  t4Filters.endDate = '';
  document.getElementById('t4-startDate').value = '';
  document.getElementById('t4-endDate').value = '';
  t4Render();
}

// 获取时间筛选范围内的数据
function t4GetFilteredBoxData(){
  return t2BoxData.filter(function(d){
    if(t4Filters.transport.length && t4Filters.transport.indexOf(String(d['运输类型'])) === -1) return false;
    if(t4Filters.origin.length && t4Filters.origin.indexOf(String(d['发货仓库'])) === -1) return false;
    if(t4Filters.dest.length && t4Filters.dest.indexOf(String(d['目的仓库'])) === -1) return false;
    var dt = parseDate(d['提货时间']);
    if(!dt) return false;
    if(t4Filters.timeMode === 'month'){
      if(t4Filters.selectedMonths.length === 0) return true;
      var mKey = dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0');
      return t4Filters.selectedMonths.indexOf(mKey) > -1;
    }
    if(t4Filters.timeMode === 'quarter'){
      if(t4Filters.selectedQuarters.length === 0) return true;
      var qKey = dt.getFullYear()+'-Q'+Math.ceil((dt.getMonth()+1)/3);
      return t4Filters.selectedQuarters.indexOf(qKey) > -1;
    }
    if(t4Filters.timeMode === 'custom'){
      if(t4Filters.startDate){ var s = new Date(t4Filters.startDate+'T00:00:00'); if(dt < s) return false; }
      if(t4Filters.endDate){ var e = new Date(t4Filters.endDate+'T23:59:59'); if(dt > e) return false; }
      return true;
    }
    return true;
  });
}

function t4GetFilteredFreightData(){
  return frData.filter(function(d){
    if(t4Filters.transport.length && t4Filters.transport.indexOf(String(d['运输类型'])) === -1) return false;
    if(t4Filters.origin.length && t4Filters.origin.indexOf(String(d['发货地'])) === -1) return false;
    if(t4Filters.dest.length && t4Filters.dest.indexOf(String(d['目的地'])) === -1) return false;
    var dt = parseDate(d['提货日期']);
    if(!dt) return false;
    if(t4Filters.timeMode === 'month'){
      if(t4Filters.selectedMonths.length === 0) return true;
      var mKey = dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0');
      return t4Filters.selectedMonths.indexOf(mKey) > -1;
    }
    if(t4Filters.timeMode === 'quarter'){
      if(t4Filters.selectedQuarters.length === 0) return true;
      var qKey = dt.getFullYear()+'-Q'+Math.ceil((dt.getMonth()+1)/3);
      return t4Filters.selectedQuarters.indexOf(qKey) > -1;
    }
    if(t4Filters.timeMode === 'custom'){
      if(t4Filters.startDate){ var s = new Date(t4Filters.startDate+'T00:00:00'); if(dt < s) return false; }
      if(t4Filters.endDate){ var e = new Date(t4Filters.endDate+'T23:59:59'); if(dt > e) return false; }
      return true;
    }
    return true;
  });
}

// 获取数据涉及的所有月份
function t4GetMonthsInData(){
  var mSet = {};
  t4GetFilteredBoxData().forEach(function(d){
    var dt = parseDate(d['提货时间']);
    if(dt){ var k = dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0'); mSet[k]=1; }
  });
  return Object.keys(mSet).sort();
}

// 计算各物流商各维度得分
function t4CalcRatings(){
  var boxData = t4GetFilteredBoxData();
  var frDataFiltered = t4GetFilteredFreightData();
  var months = t4GetMonthsInData();
  var carriers = uniqueVals(boxData, '物流商').filter(function(c){ return c && c !== 'nan' && c !== '未指定'; });

  var results = {};

  carriers.forEach(function(carrier){
    var cBox = boxData.filter(function(d){ return d['物流商'] === carrier; });
    var cFr = frDataFiltered.filter(function(d){ return d['物流商'] === carrier; });
    if(cBox.length === 0 && cFr.length === 0) return;

    // === 1. 时效维度 (35%) ===
    var validData = cBox.filter(isValidStat);
    var validQty = validData.reduce(function(s,d){ return s + qtyOf(d); }, 0);
    var excQty = validData.filter(isExc).reduce(function(s,d){ return s + qtyOf(d); }, 0);
    var compRate = validQty > 0 ? (validQty - excQty) / validQty * 100 : 0;
    var timeScore = Math.min(compRate / 95 * 100, 100); // 95%达标率=满分100，上限100
    if(validQty === 0) timeScore = 0;

    // === 2. 成本维度 (25%) ===
    // 同运输类型内对比单kg均价，最低=100
    var costScore = 0;
    var totalCw = 0, totalAmt = 0;
    cFr.forEach(function(d){
      var cw = parseFloat(d['计费重']) || 0;
      var amt = parseFloat(d['总金额']) || 0;
      if(cw > 0 && amt > 0){ totalCw += cw; totalAmt += amt; }
    });
    var avgPrice = totalCw > 0 ? totalAmt / totalCw : 0;
    if(avgPrice > 0){
      // 计算同运输类型内所有物流商的最低均价
      var transportTypes = {};
      cFr.forEach(function(d){ var t = d['运输类型'] || '未知'; if(!transportTypes[t]) transportTypes[t] = {totalCw:0, totalAmt:0}; var cw = parseFloat(d['计费重'])||0; var amt = parseFloat(d['总金额'])||0; if(cw>0&&amt>0){ transportTypes[t].totalCw+=cw; transportTypes[t].totalAmt+=amt; } });
      var typeScores = [];
      var typeWeights = [];
      Object.keys(transportTypes).forEach(function(t){
        var tt = transportTypes[t];
        if(tt.totalCw === 0) return;
        var typeAvg = tt.totalAmt / tt.totalCw;
        // 算同类型所有物流商最低价
        var minAvg = Infinity;
        frDataFiltered.forEach(function(d){
          if((d['运输类型']||'未知') !== t) return;
          if(d['物流商'] === carrier) return;
          var cw2 = parseFloat(d['计费重'])||0;
          var amt2 = parseFloat(d['总金额'])||0;
          if(cw2 > 0 && amt2 > 0){
            var a = amt2 / cw2;
            if(a < minAvg) minAvg = a;
          }
        });
        // 也包含自己
        if(typeAvg < minAvg) minAvg = typeAvg;
        if(minAvg === Infinity) minAvg = typeAvg;
        var tScore = Math.min(minAvg / typeAvg * 100, 100);
        typeScores.push(tScore);
        typeWeights.push(tt.totalCw); // 按计费重加权
      });
      if(typeScores.length > 0){
        var wSum = typeWeights.reduce(function(a,b){ return a+b; }, 0);
        costScore = typeScores.reduce(function(s,v,i){ return s + v * typeWeights[i]; }, 0) / wSum;
      }
    }

    // === 3. 服务维度 (15%) ===
    // 按月打分取平均
    var serviceScores = [];
    months.forEach(function(m){
      var stars = t4GetServiceScore(carrier, m);
      if(stars > 0) serviceScores.push(stars * 20); // 5星=100分
    });
    var serviceScore = serviceScores.length > 0 ? serviceScores.reduce(function(a,b){ return a+b; }, 0) / serviceScores.length : 0;

    // === 4. 稳定性维度 (10%) ===
    // 各月达标率标准差 → 得分 = 100 - (σ × 系数)
    var monthlyCompRates = [];
    months.forEach(function(m){
      var mData = cBox.filter(function(d){
        var dt = parseDate(d['提货时间']);
        if(!dt) return false;
        var mKey = dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0');
        return mKey === m;
      });
      var mValid = mData.filter(isValidStat);
      var mValidQty = mValid.reduce(function(s,d){ return s + qtyOf(d); }, 0);
      var mExcQty = mValid.filter(isExc).reduce(function(s,d){ return s + qtyOf(d); }, 0);
      if(mValidQty > 0) monthlyCompRates.push((mValidQty - mExcQty) / mValidQty * 100);
    });
    var stabilityScore = 100;
    if(monthlyCompRates.length >= 2){
      var mean = monthlyCompRates.reduce(function(a,b){ return a+b; }, 0) / monthlyCompRates.length;
      var variance = monthlyCompRates.reduce(function(s,v){ return s + Math.pow(v - mean, 2); }, 0) / monthlyCompRates.length;
      var stdDev = Math.sqrt(variance);
      stabilityScore = Math.max(100 - stdDev * 2, 0); // 标准差×2，越小越高
    }

    // === 5. 异常维度 (10%) ===
    // 超时异常率70% + 查验率30%
    var excRate = validQty > 0 ? excQty / validQty * 100 : 0;
    var totalQty = cBox.reduce(function(s,d){ return s + qtyOf(d); }, 0);
    var chkQty = cBox.filter(isChk).reduce(function(s,d){ return s + qtyOf(d); }, 0);
    var chkRate = totalQty > 0 ? chkQty / totalQty * 100 : 0;
    var anomalyRate = excRate * 0.7 + chkRate * 0.3;
    var anomalyScore = Math.max((1 - anomalyRate / 100) * 100, 0);

    // === 综合评分 ===
    var totalScore = timeScore * T4_WEIGHTS['时效'] + costScore * T4_WEIGHTS['成本'] + serviceScore * T4_WEIGHTS['服务'] + stabilityScore * T4_WEIGHTS['稳定性'] + anomalyScore * T4_WEIGHTS['异常'];

    // 评级
    var grade = 'D';
    if(totalScore >= 85) grade = 'A';
    else if(totalScore >= 70) grade = 'B';
    else if(totalScore >= 60) grade = 'C';

    results[carrier] = {
      carrier: carrier,
      timeScore: Math.round(timeScore * 10) / 10,
      costScore: Math.round(costScore * 10) / 10,
      serviceScore: Math.round(serviceScore * 10) / 10,
      stabilityScore: Math.round(stabilityScore * 10) / 10,
      anomalyScore: Math.round(anomalyScore * 10) / 10,
      totalScore: Math.round(totalScore * 10) / 10,
      grade: grade,
      compRate: Math.round(compRate * 100) / 100,
      excRate: Math.round(excRate * 100) / 100,
      chkRate: Math.round(chkRate * 100) / 100,
      avgPrice: Math.round(avgPrice * 100) / 100,
      totalQty: Math.round(totalQty),
      boxCount: cBox.length,
      validQty: Math.round(validQty),
      monthlyCompRates: monthlyCompRates,
      months: months
    };
  });

  return results;
}

function t4Render(){
  var results = t4CalcRatings();
  t4RenderTable(results);
  t4RenderCharts(results);
  t4RenderServiceArea();
  var count = Object.keys(results).length;
  document.getElementById('t4-filterCount').textContent = '当前评级: ' + count + ' 家物流商';
}

function t4RenderTable(results){
  var rows = Object.values(results);
  // 排序
  var sk = t4SortState.key;
  rows.sort(function(a,b){ return t4SortState.desc ? (b[sk] - a[sk]) : (a[sk] - b[sk]); });

  // 搜索
  var q = (document.getElementById('t4-searchInput').value || '').toLowerCase().trim();
  if(q) rows = rows.filter(function(r){ return r.carrier.toLowerCase().indexOf(q) > -1; });

  var cols = [
    {k:'rank', l:'排名'},
    {k:'carrier', l:'物流商'},
    {k:'grade', l:'评级'},
    {k:'totalScore', l:'综合评分'},
    {k:'timeScore', l:'时效(35%)'},
    {k:'costScore', l:'成本(25%)'},
    {k:'serviceScore', l:'服务(15%)'},
    {k:'stabilityScore', l:'稳定性(10%)'},
    {k:'anomalyScore', l:'异常(10%)'},
    {k:'compRate', l:'达标率'},
    {k:'excRate', l:'超时率'},
    {k:'chkRate', l:'查验率'},
    {k:'avgPrice', l:'单kg均价'},
    {k:'totalQty', l:'总件数'},
    {k:'boxCount', l:'箱数'}
  ];

  var sortArrow = function(k){ return t4SortState.key === k ? (t4SortState.desc ? ' ↓' : ' ↑') : ''; };

  document.querySelector('#t4-ratingTable thead').innerHTML = '<tr>' + cols.map(function(c){
    return '<th onclick="t4SortBy(\''+c.k+'\')" style="cursor:pointer;white-space:nowrap">' + c.l + '<span class="arrow">'+sortArrow(c.k)+'</span></th>';
  }).join('') + '</tr>';

  document.querySelector('#t4-ratingTable tbody').innerHTML = rows.map(function(r, i){
    var rank = i + 1;
    var gradeClass = 'rating-' + r.grade;
    var compColor = r.compRate >= 80 ? 'tag-green' : (r.compRate >= 60 ? 'tag-orange' : 'tag-red');
    var excColor = r.excRate > 20 ? 'tag-red' : (r.excRate > 10 ? 'tag-orange' : 'tag-green');
    return '<tr style="cursor:pointer" onclick="t4ShowDetail(\''+escapeAttr(r.carrier)+'\')">'+
      '<td>'+rank+'</td>'+
      '<td style="font-weight:600;color:#4c1d95">'+escapeHtml(r.carrier)+'</td>'+
      '<td><span class="rating-badge '+gradeClass+'">'+r.grade+'</span></td>'+
      '<td><span class="score-cell" style="color:'+ (r.totalScore>=85?'#059669':r.totalScore>=70?'#7c3aed':r.totalScore>=60?'#d97706':'#dc2626') +'">'+r.totalScore+'</span></td>'+
      '<td><span class="dim-score">'+r.timeScore+'</span></td>'+
      '<td><span class="dim-score">'+r.costScore+'</span></td>'+
      '<td><span class="dim-score">'+(r.serviceScore>0?r.serviceScore:'<span style="color:#ccc">未评</span>')+'</span></td>'+
      '<td><span class="dim-score">'+r.stabilityScore+'</span></td>'+
      '<td><span class="dim-score">'+r.anomalyScore+'</span></td>'+
      '<td><span class="tag '+compColor+'">'+r.compRate+'%</span></td>'+
      '<td><span class="tag '+excColor+'">'+r.excRate+'%</span></td>'+
      '<td>'+(r.chkRate>0?'<span class="tag '+(r.chkRate>10?'tag-red':'tag-orange')+'">'+r.chkRate+'%</span>':'-')+'</td>'+
      '<td>'+(r.avgPrice>0?'¥'+r.avgPrice:'-')+'</td>'+
      '<td>'+r.totalQty.toLocaleString()+'</td>'+
      '<td>'+r.boxCount+'</td>'+
      '</tr>';
  }).join('') || '<tr><td colspan="15" class="empty">无数据</td></tr>';

  document.getElementById('t4-detailCount').textContent = '共 ' + rows.length + ' 家物流商';
}

function t4SortBy(key){
  if(t4SortState.key === key) t4SortState.desc = !t4SortState.desc;
  else { t4SortState.key = key; t4SortState.desc = true; }
  t4RenderTable(t4CalcRatings());
}
function t4SearchTable(){ t4RenderTable(t4CalcRatings()); }

function t4RenderCharts(results){
  var rows = Object.values(results).sort(function(a,b){ return b.totalScore - a.totalScore; });
  var top10 = rows.slice(0, 10);

  // 1. 雷达图
  var radarIndicators = [
    {name:'时效', max:100}, {name:'成本', max:100}, {name:'服务', max:100}, {name:'稳定性', max:100}, {name:'异常', max:100}
  ];
  var radarSeries = top10.slice(0, 6).map(function(r, i){
    return {
      name: r.carrier,
      type: 'radar',
      data: [{
        value: [r.timeScore, r.costScore, r.serviceScore || 0, r.stabilityScore, r.anomalyScore],
        name: r.carrier,
        areaStyle: { opacity: 0.1 }
      }],
      lineStyle: { color: PALETTE[i] },
      itemStyle: { color: PALETTE[i] },
      areaStyle: { color: PALETTE[i], opacity: 0.1 }
    };
  });
  t3SetOption('t4-c-radar', {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { fontSize: 11, color: '#6b7280' } },
    radar: { indicator: radarIndicators, center: ['50%','48%'], radius: '60%', splitArea: { areaStyle: { color: ['#faf8ff','#f5f3ff'] } }, axisName: { color: '#4c1d95', fontSize: 12 } },
    series: radarSeries
  });

  // 2. 综合评分排名柱状图
  t3SetOption('t4-c-ranking', {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: function(p){ return p[0].name + '<br/>综合评分: ' + p[0].value + '<br/>评级: ' + top10[p[0].dataIndex].grade; } },
    grid: { left: 10, right: 20, top: 20, bottom: 60, containLabel: true },
    xAxis: { type: 'category', data: top10.map(function(r){ return r.carrier; }), axisLabel: { rotate: 35, color: '#6b7280', fontSize: 11 } },
    yAxis: { type: 'value', name: '评分', max: 100, axisLabel: { color: '#9ca3af' } },
    series: [{
      type: 'bar',
      data: top10.map(function(r){ return { value: r.totalScore, itemStyle: { color: r.totalScore>=85?'#059669':r.totalScore>=70?'#7c3aed':r.totalScore>=60?'#d97706':'#dc2626' } }; }),
      barMaxWidth: 36,
      borderRadius: [4,4,0,0],
      label: { show: true, position: 'top', formatter: '{c}', color: '#6b7280', fontSize: 11 }
    }]
  });

  // 3. 月度评分趋势
  var months = t4GetMonthsInData();
  var trendSeries = top10.slice(0, 5).map(function(r, i){
    // 重新计算各月综合评分
    var monthlyScores = months.map(function(m){
      var mData = t2BoxData.filter(function(d){
        if(d['物流商'] !== r.carrier) return false;
        var dt = parseDate(d['提货时间']);
        if(!dt) return false;
        var mKey = dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0');
        return mKey === m;
      });
      var mValid = mData.filter(isValidStat);
      var mValidQty = mValid.reduce(function(s,d){ return s + qtyOf(d); }, 0);
      var mExcQty = mValid.filter(isExc).reduce(function(s,d){ return s + qtyOf(d); }, 0);
      var mCompRate = mValidQty > 0 ? (mValidQty - mExcQty) / mValidQty * 100 : 0;
      var mTimeScore = Math.min(mCompRate / 95 * 100, 100);
      var mChkQty = mData.filter(isChk).reduce(function(s,d){ return s + qtyOf(d); }, 0);
      var mTotalQty = mData.reduce(function(s,d){ return s + qtyOf(d); }, 0);
      var mExcRate = mValidQty > 0 ? mExcQty / mValidQty * 100 : 0;
      var mChkRate = mTotalQty > 0 ? mChkQty / mTotalQty * 100 : 0;
      var mAnomalyRate = mExcRate * 0.7 + mChkRate * 0.3;
      var mAnomalyScore = Math.max((1 - mAnomalyRate / 100) * 100, 0);
      var mServiceScore = (t4GetServiceScore(r.carrier, m) || 0) * 20;
      // 简化：成本和稳定性用全局值
      var mTotal = mTimeScore * T4_WEIGHTS['时效'] + r.costScore * T4_WEIGHTS['成本'] + mServiceScore * T4_WEIGHTS['服务'] + r.stabilityScore * T4_WEIGHTS['稳定性'] + mAnomalyScore * T4_WEIGHTS['异常'];
      return Math.round(mTotal * 10) / 10;
    });
    return { name: r.carrier, type: 'line', smooth: true, data: monthlyScores, itemStyle: { color: PALETTE[i] }, lineStyle: { color: PALETTE[i] } };
  });
  t3SetOption('t4-c-trend', {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, textStyle: { fontSize: 11, color: '#6b7280' } },
    grid: { left: 10, right: 20, top: 20, bottom: 50, containLabel: true },
    xAxis: { type: 'category', data: months, axisLabel: { color: '#6b7280', fontSize: 11 } },
    yAxis: { type: 'value', name: '评分', max: 100, axisLabel: { color: '#9ca3af' } },
    series: trendSeries
  });

  // 4. 各维度得分对比
  var dimNames = ['时效', '成本', '服务', '稳定性', '异常'];
  var dimKeys = ['timeScore', 'costScore', 'serviceScore', 'stabilityScore', 'anomalyScore'];
  var dimSeries = top10.slice(0, 5).map(function(r, i){
    return {
      name: r.carrier,
      type: 'bar',
      data: dimKeys.map(function(k){ return r[k] || 0; }),
      itemStyle: { color: PALETTE[i], borderRadius: [3,3,0,0] },
      barMaxWidth: 20
    };
  });
  t3SetOption('t4-c-dimcompare', {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, textStyle: { fontSize: 11, color: '#6b7280' } },
    grid: { left: 10, right: 20, top: 20, bottom: 50, containLabel: true },
    xAxis: { type: 'category', data: dimNames, axisLabel: { color: '#4c1d95', fontSize: 12, fontWeight: 600 } },
    yAxis: { type: 'value', name: '得分', max: 100, axisLabel: { color: '#9ca3af' } },
    series: dimSeries
  });
}

function t4RenderServiceArea(){
  var months = t4GetMonthsInData();
  var carriers = uniqueVals(t4GetFilteredBoxData(), '物流商').filter(function(c){ return c && c !== 'nan' && c !== '未指定'; }).sort();
  var html = '';

  if(months.length === 0){
    html = '<div class="empty">请先选择时间范围</div>';
  } else {
    // 表头
    html += '<div style="display:flex;flex-wrap:wrap;gap:16px">';
    months.forEach(function(m){
      html += '<div style="min-width:280px;flex:1">'+
        '<div style="font-weight:600;color:#7c3aed;margin-bottom:6px;padding:6px 10px;background:#f5f3ff;border-radius:8px">'+m+' 服务打分</div>';
      carriers.forEach(function(c){
        var stars = t4GetServiceScore(c, m);
        var starHtml = '';
        for(var i = 1; i <= 5; i++){
          starHtml += '<span class="star'+(i<=stars?' active':'')+'" onclick="t4ClickStar(\''+escapeAttr(c)+'\',\''+m+'\','+i+')">★</span>';
        }
        html += '<div class="service-row">'+
          '<span class="carrier-name">'+escapeHtml(c)+'</span>'+
          '<span class="star-rating">'+starHtml+'</span>'+
          '<span class="score-text">'+(stars>0?(stars*20)+'分':'未评')+'</span>'+
          '</div>';
      });
      html += '</div>';
    });
    html += '</div>';
  }

  document.getElementById('t4-serviceArea').innerHTML = html;
}

function t4ClickStar(carrier, month, stars){
  var current = t4GetServiceScore(carrier, month);
  // 如果点的是当前已选的星，则取消
  if(current === stars) stars = 0;
  t4SetServiceScore(carrier, month, stars);
  t4RenderServiceArea();
  t4Render();
}

function t4ShowDetail(carrier){
  var results = t4CalcRatings();
  var r = results[carrier];
  if(!r) return;

  var html = '<div style="margin-bottom:16px">'+
    '<h3 style="color:#4c1d95;margin-bottom:12px">'+escapeHtml(carrier)+' 评级详情</h3>'+
    '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:16px">'+
    '<div class="kpi"><div class="k-label">综合评分</div><div class="k-value" style="color:'+ (r.totalScore>=85?'#059669':r.totalScore>=70?'#7c3aed':r.totalScore>=60?'#d97706':'#dc2626') +'">'+r.totalScore+'</div><div class="k-sub"><span class="rating-badge rating-'+r.grade+'">'+r.grade+'级</span></div></div>'+
    '<div class="kpi"><div class="k-label">时效得分</div><div class="k-value">'+r.timeScore+'</div><div class="k-sub">达标率 '+r.compRate+'%</div></div>'+
    '<div class="kpi"><div class="k-label">成本得分</div><div class="k-value">'+r.costScore+'</div><div class="k-sub">'+(r.avgPrice>0?'¥'+r.avgPrice+'/kg':'无数据')+'</div></div>'+
    '<div class="kpi"><div class="k-label">服务得分</div><div class="k-value">'+(r.serviceScore>0?r.serviceScore:'-')+'</div><div class="k-sub">'+(r.serviceScore>0?Math.round(r.serviceScore/20)+'星':'未评分')+'</div></div>'+
    '<div class="kpi"><div class="k-label">异常得分</div><div class="k-value">'+r.anomalyScore+'</div><div class="k-sub">超时'+r.excRate+'% / 查验'+r.chkRate+'%</div></div>'+
    '</div>'+
    '<div class="kpi" style="margin-bottom:12px"><div class="k-label">稳定性得分</div><div class="k-value" style="font-size:22px">'+r.stabilityScore+'</div><div class="k-sub">各月达标率波动度</div></div>'+
    '</div>';

  // 雷达图
  html += '<div class="chart-card" style="width:100%"><div class="ctitle">'+escapeHtml(carrier)+' 五维雷达图</div><div id="t4-detail-radar" style="width:100%;height:400px"></div></div>';

  // 月度达标率趋势
  if(r.months && r.months.length > 0){
    html += '<div class="chart-card" style="margin-top:12px;width:100%"><div class="ctitle">月度达标率趋势</div><div id="t4-detail-trend" style="width:100%;height:280px"></div></div>';
  }

  openModal(carrier + ' 评级详情', html);

  // 渲染雷达图（延迟300ms等待modal动画完成）
  setTimeout(function(){
    var radarEl = document.getElementById('t4-detail-radar');
    if(radarEl){
      radarEl.style.width = radarEl.parentElement.clientWidth - 36 + 'px';
      var rc = echarts.init(radarEl);
      allCharts['t4-detail-radar'] = rc;
      rc.setOption({
        tooltip: { trigger: 'item' },
        radar: {
          indicator: [
            {name:'时效(35%)', max:100}, {name:'成本(25%)', max:100}, {name:'服务(15%)', max:100}, {name:'稳定性(10%)', max:100}, {name:'异常(10%)', max:100}
          ],
          center: ['50%','50%'],
          radius: '70%',
          splitArea: { areaStyle: { color: ['#faf8ff','#f5f3ff'] } },
          axisName: { color: '#4c1d95', fontSize: 13, fontWeight: 600 }
        },
        series: [{
          type: 'radar',
          data: [{
            value: [r.timeScore, r.costScore, r.serviceScore || 0, r.stabilityScore, r.anomalyScore],
            name: carrier,
            areaStyle: { color: 'rgba(124,58,237,0.2)' },
            lineStyle: { color: '#7c3aed', width: 2 },
            itemStyle: { color: '#7c3aed' }
          }]
        }]
      });
      rc.resize();
    }

    // 月度趋势
    var trendEl = document.getElementById('t4-detail-trend');
    if(trendEl && r.months && r.months.length > 0){
      trendEl.style.width = trendEl.parentElement.clientWidth - 36 + 'px';
      var tc = echarts.init(trendEl);
      allCharts['t4-detail-trend'] = tc;
      tc.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: 10, right: 20, top: 20, bottom: 30, containLabel: true },
        xAxis: { type: 'category', data: r.months, axisLabel: { color: '#6b7280', fontSize: 10 } },
        yAxis: { type: 'value', max: 100, axisLabel: { color: '#9ca3af', formatter: '{value}%' } },
        series: [{
          type: 'line',
          smooth: true,
          data: r.monthlyCompRates.map(function(v){ return Math.round(v * 100) / 100; }),
          itemStyle: { color: '#7c3aed' },
          areaStyle: { color: 'rgba(124,58,237,0.15)' },
          label: { show: true, position: 'top', formatter: '{c}%', fontSize: 10, color: '#6b7280' }
        }]
      });
      tc.resize();
    }
  }, 300);
}

function t4ShowMethod(){
  var html = '<div style="max-width:680px;line-height:1.8;font-size:14px">'+
    '<div style="background:#faf8ff;border-radius:8px;padding:14px;margin-bottom:12px"><b style="color:#7c3aed">评级模型</b><br>'+
    '综合评分 = 时效(35%) + 成本(25%) + 服务(15%) + 稳定性(10%) + 异常(10%)，每个维度满分100分。<br>'+
    '评级标准：A级 ≥ 85分 | B级 70-84分 | C级 60-69分 | D级 < 60分。</div>'+
    '<div style="background:#faf8ff;border-radius:8px;padding:14px;margin-bottom:12px"><b style="color:#7c3aed">时效维度 (35%)</b><br>'+
    '达标率 = 达标件数 / 有效统计件数 × 100%（按件数计算）。<br>'+
    '得分 = 达标率 / 95% × 100，上限100分。即达标率95%即为满分。</div>'+
    '<div style="background:#faf8ff;border-radius:8px;padding:14px;margin-bottom:12px"><b style="color:#7c3aed">成本维度 (25%)</b><br>'+
    '单kg均价 = 总金额 / 计费重。同运输类型内对比，最低均价 = 100分，其他按比例计算。<br>'+
    '最终得分按各运输类型的计费重占比加权平均，确保空运对标空运、海运对标海运。</div>'+
    '<div style="background:#faf8ff;border-radius:8px;padding:14px;margin-bottom:12px"><b style="color:#7c3aed">服务维度 (15%)</b><br>'+
    '人工按月打分（1-5星），每星 = 20分（5星=100分）。<br>'+
    '评分数据保存在浏览器本地(localStorage)，切换设备后需重新打分。</div>'+
    '<div style="background:#faf8ff;border-radius:8px;padding:14px;margin-bottom:12px"><b style="color:#7c3aed">稳定性维度 (10%)</b><br>'+
    '计算各月达标率的标准差(σ)，得分 = 100 - (σ × 2)，下限0分。<br>'+
    '标准差越小代表表现越稳定，忽高忽低的物流商会被扣分。</div>'+
    '<div style="background:#faf8ff;border-radius:8px;padding:14px;margin-bottom:12px"><b style="color:#7c3aed">异常维度 (10%)</b><br>'+
    '综合异常率 = 超时异常率 × 70% + 查验率 × 30%。<br>'+
    '超时权重更高(70%)，因为超时是物流商自身可控的；查验(30%)有一定随机性。<br>'+
    '得分 = (1 - 综合异常率/100) × 100。</div>'+
    '<div style="background:#faf8ff;border-radius:8px;padding:14px"><b style="color:#7c3aed">时间区间选择</b><br>'+
    '按月：可多选月份，评级基于所选月份数据汇总；<br>'+
    '按季度：可多选季度(Q1-Q4)；<br>'+
    '自定义：自由选择起止日期。稳定性维度的月度波动分析始终基于所选范围内的月份数据。</div>'+
    '</div>';
  openModal('供应商评级口径说明', html);
}

var T4_CHART_IDS = ['t4-c-radar','t4-c-ranking','t4-c-trend','t4-c-dimcompare'];
function t4InitCharts(){ T4_CHART_IDS.forEach(initChart); }

// ============================================================
// Tab5: 渠道推荐
// ============================================================
var t5Filters = { '运输类型':[], '发货地':[], '一级分类':[], '目的地分类':[], '时效要求':[] };
var t5Mselects = {};
var t5PriceWindow = 7; // 默认近1周

function t5InitFilters(){
  var cfgs = [
    {id:'t5-f-transport', key:'运输类型', opts:uniqueVals(frData,'运输类型').filter(function(v){ return v && v!=='nan'; })},
    {id:'t5-f-origin', key:'发货地', opts:uniqueVals(frData,'发货地').filter(function(v){ return v && v!=='nan'; })},
    {id:'t5-f-cat', key:'一级分类', opts:uniqueVals(frData,'一级分类').filter(function(v){ return v && v!=='nan'; })},
    {id:'t5-f-dest', key:'目的地分类', opts:uniqueVals(frData,'目的地分类').filter(function(v){ return v && v!=='nan'; })},
    {id:'t5-f-period', key:'时效要求', opts:uniqueVals(frData,'时效要求').filter(function(v){ return v && v!=='nan'; })}
  ];
  cfgs.forEach(function(c){ t5Mselects[c.key] = initMselect(c.id, c.key, c.opts, t5Filters, t5Render); });
}

function t5Reset(){
  for(var k in t5Mselects){ t5Mselects[k].reset(); }
  t5Render();
}

function t5SetPriceWindow(days, evt){
  t5PriceWindow = days;
  document.querySelectorAll('#t5-priceWindow .src-tab').forEach(function(t){ t.classList.remove('active'); });
  var btn = (evt && evt.target) ? evt.target : document.querySelector('#t5-priceWindow .src-tab[onclick*="'+days+'"]');
  if(btn) btn.classList.add('active');
  t5Render();
}

// 价格输入存储
function t5GetPriceInputKey(carrier, channel){
  return 't5_price|'+carrier+'|'+channel;
}
function t5GetPriceInput(carrier, channel){
  var v = localStorage.getItem(t5GetPriceInputKey(carrier, channel));
  return v ? parseFloat(v) : null;
}
function t5SetPriceInput(carrier, channel, val){
  var key = t5GetPriceInputKey(carrier, channel);
  if(val && val > 0) localStorage.setItem(key, val);
  else localStorage.removeItem(key);
}

function t5FilterFr(d){
  for(var k in t5Filters){
    if(t5Filters[k].length && t5Filters[k].indexOf(String(d[k])) === -1) return false;
  }
  return true;
}

function t5FilterBox(d){
  // 箱数据字段名不同，做映射
  if(t5Filters['运输类型'].length && t5Filters['运输类型'].indexOf(String(d['运输类型'])) === -1) return false;
  if(t5Filters['发货地'].length && t5Filters['发货地'].indexOf(String(d['发货仓库'])) === -1) return false;
  if(t5Filters['一级分类'].length && t5Filters['一级分类'].indexOf(String(d['一级分类'])) === -1) return false;
  if(t5Filters['时效要求'].length && t5Filters['时效要求'].indexOf(String(d['时效要求'])) === -1) return false;
  // 目的地分类 → 仓库类型映射（近似）
  if(t5Filters['目的地分类'].length){
    var whType = String(d['仓库类型']||'');
    if(t5Filters['目的地分类'].indexOf(whType) === -1) return false;
  }
  return true;
}

function t5Render(){
  var frFiltered = frData.filter(t5FilterFr);
  var boxFiltered = t2BoxData.filter(t5FilterBox);

  // 按 物流商+物流渠道 分组
  var groups = {};
  frFiltered.forEach(function(d){
    var carrier = d['物流商'] || '未知';
    var channel = d['物流渠道'] || '未知';
    var key = carrier + '||' + channel;
    if(!groups[key]) groups[key] = { carrier:carrier, channel:channel, frRecords:[], boxRecords:[] };
    groups[key].frRecords.push(d);
  });

  // 匹配箱数据（用于达标率和异常率）
  boxFiltered.forEach(function(d){
    var carrier = d['物流商'] || '未知';
    var channel = d['物流渠道'] || '';
    // 箱数据可能没有物流渠道字段，用物流商匹配
    Object.keys(groups).forEach(function(key){
      if(groups[key].carrier === carrier){
        // 如果箱数据有物流渠道且不匹配则跳过
        if(channel && groups[key].channel !== '未知' && channel !== groups[key].channel) return;
        groups[key].boxRecords.push(d);
      }
    });
  });

  // 计算每个渠道组合的指标
  var now = new Date();
  var windowMs = t5PriceWindow * 86400000;
  var results = [];

  Object.keys(groups).forEach(function(key){
    var g = groups[key];
    var frRecs = g.frRecords;
    var boxRecs = g.boxRecords;
    if(frRecs.length === 0 && boxRecs.length === 0) return;

    // 达标率（从箱数据）
    var validData = boxRecs.filter(isValidStat);
    var validQty = validData.reduce(function(s,d){ return s + qtyOf(d); }, 0);
    var excQty = validData.filter(isExc).reduce(function(s,d){ return s + qtyOf(d); }, 0);
    var compRate = validQty > 0 ? (validQty - excQty) / validQty * 100 : -1;
    var totalQty = boxRecs.reduce(function(s,d){ return s + qtyOf(d); }, 0);
    var chkQty = boxRecs.filter(isChk).reduce(function(s,d){ return s + qtyOf(d); }, 0);
    var chkRate = totalQty > 0 ? chkQty / totalQty * 100 : 0;
    var excRate = validQty > 0 ? excQty / validQty * 100 : 0;

    // 近期均价（从运费数据，按时间窗口）
    var recentFr = frRecs.filter(function(d){
      var dt = parseDate(d['提货日期']);
      return dt && (now.getTime() - dt.getTime()) <= windowMs;
    });
    var prevWindowFr = frRecs.filter(function(d){
      var dt = parseDate(d['提货日期']);
      return dt && (now.getTime() - dt.getTime()) > windowMs && (now.getTime() - dt.getTime()) <= windowMs * 2;
    });

    var recentCw = 0, recentAmt = 0;
    recentFr.forEach(function(d){
      var cw = parseFloat(d['计费重'])||0;
      var amt = parseFloat(d['总金额'])||0;
      if(cw > 0 && amt > 0){ recentCw += cw; recentAmt += amt; }
    });
    var recentAvg = recentCw > 0 ? recentAmt / recentCw : 0;

    var prevCw = 0, prevAmt = 0;
    prevWindowFr.forEach(function(d){
      var cw = parseFloat(d['计费重'])||0;
      var amt = parseFloat(d['总金额'])||0;
      if(cw > 0 && amt > 0){ prevCw += cw; prevAmt += amt; }
    });
    var prevAvg = prevCw > 0 ? prevAmt / prevCw : 0;

    // 价格趋势
    var trend = 'flat';
    var trendPct = 0;
    if(recentAvg > 0 && prevAvg > 0){
      trendPct = Math.round((recentAvg - prevAvg) / prevAvg * 100);
      if(trendPct < -3) trend = 'down';
      else if(trendPct > 3) trend = 'up';
    }

    // 价格区间
    var priceMin = 0, priceMax = 0;
    var priceList = [];
    frRecs.forEach(function(d){
      var cw = parseFloat(d['计费重'])||0;
      var amt = parseFloat(d['总金额'])||0;
      if(cw > 0 && amt > 0) priceList.push(amt / cw);
    });
    if(priceList.length > 0){
      priceMin = Math.min.apply(null, priceList);
      priceMax = Math.max.apply(null, priceList);
    }

    // 用户输入价格
    var userInput = t5GetPriceInput(g.carrier, g.channel);
    var usePrice = userInput || recentAvg;

    // 样本量
    var sampleCount = frRecs.length + boxRecs.length;

    results.push({
      carrier: g.carrier,
      channel: g.channel,
      compRate: compRate,
      excRate: Math.round(excRate * 100) / 100,
      chkRate: Math.round(chkRate * 100) / 100,
      recentAvg: Math.round(recentAvg * 100) / 100,
      prevAvg: Math.round(prevAvg * 100) / 100,
      trend: trend,
      trendPct: trendPct,
      priceMin: Math.round(priceMin * 100) / 100,
      priceMax: Math.round(priceMax * 100) / 100,
      userInput: userInput,
      usePrice: Math.round(usePrice * 100) / 100,
      sampleCount: sampleCount,
      frCount: frRecs.length,
      boxCount: boxRecs.length,
      recentCount: recentFr.length,
      totalQty: Math.round(totalQty),
      validQty: Math.round(validQty)
    });
  });

  // 排序：用户价格升序 + 达标率降序 + 异常率升序
  results.sort(function(a, b){
    // 价格越低越好
    if(a.usePrice > 0 && b.usePrice > 0 && a.usePrice !== b.usePrice) return a.usePrice - b.usePrice;
    // 达标率越高越好
    if(a.compRate >= 0 && b.compRate >= 0 && a.compRate !== b.compRate) return b.compRate - a.compRate;
    // 异常率越低越好
    if(a.excRate !== b.excRate) return a.excRate - b.excRate;
    return 0;
  });

  t5RenderResults(results);
  document.getElementById('t5-filterCount').textContent = '匹配: ' + results.length + ' 个渠道';
}

function t5RenderResults(results){
  var html = '';

  if(results.length === 0){
    html = '<div class="detail" style="margin-top:16px"><div class="empty">未匹配到渠道数据，请调整筛选条件</div></div>';
    document.getElementById('t5-recommendArea').innerHTML = html;
    return;
  }

  // 分组：推荐 / 样本少 / 不推荐
  var recommended = results.filter(function(r){ return r.sampleCount >= 3 && r.compRate >= 0 && r.compRate >= 60; });
  var warnSample = results.filter(function(r){ return r.sampleCount >= 3 && (r.compRate < 0 || r.compRate < 60); });
  var fewSample = results.filter(function(r){ return r.sampleCount < 3; });

  var rank = 0;
  var renderCard = function(r, isWarn, isFew){
    var cardClass = 'rec-card';
    var rankClass = 'rec-rank';
    var gradeText = '';
    var gradeBg = '';

    if(isFew){
      cardClass += ' rec-warn';
      rankClass += ' rec-warn';
      gradeText = '样本不足';
      gradeBg = '#d97706';
    } else if(isWarn){
      cardClass += ' rec-na';
      rankClass += ' rec-na';
      gradeText = '不推荐';
      gradeBg = '#dc2626';
    } else {
      if(r.compRate >= 85 && r.excRate <= 10){ cardClass += ' rec-a'; rankClass += ' rec-a'; gradeText = '优选'; gradeBg = '#059669'; }
      else { cardClass += ' rec-b'; gradeText = '可选'; gradeBg = '#7c3aed'; }
      rank++;
    }

    var rankNum = isFew ? '!' : (isWarn ? '×' : rank);
    var trendHtml = '';
    if(r.recentAvg > 0){
      if(r.trend === 'down') trendHtml = '<span class="rec-trend-down">↓ '+Math.abs(r.trendPct)+'%</span>';
      else if(r.trend === 'up') trendHtml = '<span class="rec-trend-up">↑ '+r.trendPct+'%</span>';
      else trendHtml = '<span class="rec-trend-flat">→ 平稳</span>';
    }

    var priceHint = r.recentAvg > 0 ? '近期均价 ¥'+r.recentAvg+'/kg' : '无近期价格数据';
    if(r.priceMin > 0 && r.priceMax > 0) priceHint += ' (区间 ¥'+r.priceMin+'~¥'+r.priceMax+')';

    // 推荐理由
    var reason = '';
    if(isFew){
      reason = '该渠道在当前筛选条件下仅有 '+r.sampleCount+' 条记录，数据不足以做可靠推荐。';
    } else if(isWarn){
      reason = '达标率仅 '+r.compRate+'%，超时率 '+r.excRate+'%';
      if(r.chkRate > 0) reason += '，查验率 '+r.chkRate+'%';
      reason += '。虽然价格可能较低，但时效和可靠性存在风险。';
    } else {
      var parts = [];
      if(r.compRate >= 85) parts.push('时效达标率高('+r.compRate+'%)');
      if(r.excRate <= 5) parts.push('超时率低('+r.excRate+'%)');
      if(r.chkRate <= 2) parts.push('查验率低('+r.chkRate+'%)');
      if(r.trend === 'down') parts.push('价格近期走低');
      if(r.usePrice > 0 && r.usePrice <= 10) parts.push('价格有竞争力(¥'+r.usePrice+'/kg)');
      reason = parts.length > 0 ? '优势：' + parts.join('，') + '。' : '综合表现尚可。';
    }

    var escCarrier = escapeAttr(r.carrier);
    var escChannel = escapeAttr(r.channel);
    var inputVal = r.userInput ? r.userInput : '';

    html += '<div class="'+cardClass+'">'+
      '<div class="rec-head">'+
        '<div class="'+rankClass+'">'+rankNum+'</div>'+
        '<div class="rec-channel">'+escapeHtml(r.carrier)+' / '+escapeHtml(r.channel)+'</div>'+
        '<span class="rec-grade" style="background:'+gradeBg+'">'+gradeText+'</span>'+
        '<span style="font-size:12px;color:#9ca3af;margin-left:auto">'+r.sampleCount+'条记录 (运费'+r.frCount+' / 箱'+r.boxCount+')</span>'+
      '</div>'+
      '<div class="rec-body">'+
        '<div class="rec-stat"><div class="l">时效达标率</div><div class="v">'+(r.compRate>=0?r.compRate+'%':'<span class="sub">无数据</span>')+'</div></div>'+
        '<div class="rec-stat"><div class="l">超时率</div><div class="v">'+r.excRate+'%</div></div>'+
        '<div class="rec-stat"><div class="l">查验率</div><div class="v">'+(r.chkRate>0?r.chkRate+'%':'-')+'</div></div>'+
        '<div class="rec-stat"><div class="l">近期均价</div><div class="v">'+(r.recentAvg>0?'¥'+r.recentAvg+'/kg':'<span class="sub">无数据</span>')+' <span class="sub">'+(r.recentCount+'条')+'</span></div></div>'+
      '</div>'+
      '<div class="rec-price-row">'+
        '<label>本周单价:</label>'+
        '<input type="number" class="rec-price-input" placeholder="'+(r.recentAvg>0?'¥'+r.recentAvg:'填价格')+'" value="'+inputVal+'" oninput="t5OnPriceInput(\''+escCarrier+'\',\''+escChannel+'\',this.value)" step="0.1">'+
        '<span class="rec-price-hint">'+priceHint+'</span>'+
        (r.recentAvg > 0 ? '<span class="rec-price-trend '+ (r.trend==='down'?'rec-trend-down':r.trend==='up'?'rec-trend-up':'rec-trend-flat') +'">'+trendHtml+'</span>' : '')+
      '</div>'+
      '<div class="rec-reason">'+reason+'</div>'+
      '</div>';
  };

  if(recommended.length > 0){
    html += '<div style="font-size:16px;font-weight:700;color:#4c1d95;margin:20px 0 12px;padding-left:12px;border-left:4px solid #7c3aed">推荐渠道</div>';
    recommended.forEach(function(r){ renderCard(r, false, false); });
  }

  if(fewSample.length > 0){
    html += '<div style="font-size:16px;font-weight:700;color:#d97706;margin:20px 0 12px;padding-left:12px;border-left:4px solid #d97706">样本不足</div>';
    fewSample.forEach(function(r){ renderCard(r, false, true); });
  }

  if(warnSample.length > 0){
    html += '<div style="font-size:16px;font-weight:700;color:#dc2626;margin:20px 0 12px;padding-left:12px;border-left:4px solid #dc2626">不推荐</div>';
    warnSample.forEach(function(r){ renderCard(r, true, false); });
  }

  document.getElementById('t5-recommendArea').innerHTML = html;
}

function t5OnPriceInput(carrier, channel, val){
  var num = parseFloat(val);
  t5SetPriceInput(carrier, channel, num);
  // 实时重算（防抖）
  clearTimeout(window._t5Timer);
  window._t5Timer = setTimeout(function(){ t5Render(); }, 400);
}

function t5ShowMethod(){
  var html = '<div style="max-width:680px;line-height:1.8;font-size:14px">'+
    '<div style="background:#faf8ff;border-radius:8px;padding:14px;margin-bottom:12px"><b style="color:#7c3aed">渠道推荐逻辑</b><br>'+
    '根据您选择的条件（运输类型/发货地/一级分类/目的地分类/时效要求），从历史数据中匹配同类发货记录，按"物流商+物流渠道"组合统计达标率、异常率和价格，自动排序推荐。</div>'+
    '<div style="background:#faf8ff;border-radius:8px;padding:14px;margin-bottom:12px"><b style="color:#7c3aed">价格计算</b><br>'+
    '优先使用您手动填入的"本周单价"。如未填写，则自动使用"近期均价"（按选择的时间窗口1/2/4/8周计算）。<br>'+
    '近期均价 = 该渠道在时间窗口内的总金额 / 总计费重。'+
    '价格趋势 = 当前窗口均价 vs 上一个同等窗口均价，变化超3%显示涨跌。</div>'+
    '<div style="background:#faf8ff;border-radius:8px;padding:14px;margin-bottom:12px"><b style="color:#7c3aed">推荐分级</b><br>'+
    '优选：达标率≥85% 且 超时率≤10%<br>'+
    '可选：达标率≥60% 且 超时率可接受<br>'+
    '不推荐：达标率<60% 或 超时率过高<br>'+
    '样本不足：历史记录<3条，数据不可靠</div>'+
    '<div style="background:#faf8ff;border-radius:8px;padding:14px;margin-bottom:12px"><b style="color:#7c3aed">排序规则</b><br>'+
    '推荐渠道内按：价格(升序) → 达标率(降序) → 异常率(升序) 排列。填入价格后实时重新排序。</div>'+
    '<div style="background:#faf8ff;border-radius:8px;padding:14px"><b style="color:#7c3aed">数据来源</b><br>'+
    '时效达标率/超时率/查验率：来自箱维度数据（与Tab2一致的口径）。<br>'+
    '价格/均价：来自大货运费表（与Tab3一致的计费重和总金额字段）。<br>'+
    '手填价格保存在浏览器本地，切换设备需重新填写。</div>'+
    '</div>';
  openModal('渠道推荐说明', html);
}


window.addEventListener('DOMContentLoaded', function(){
  t1InitCharts(); t1InitFilters(); t1Render();
  t2InitCharts(); t2InitFilters(); t2Render();
  t3InitFilters(); t3InitCharts(); t3Render();
  t4InitCharts(); t4InitFilters(); t4Render();
  t5InitFilters(); t5Render();
});
