// assets/js/main.js
// وظائف: تحميل التمارين، عرضها، تسجيل السجلات، رسم مخطط بسيط، بحث، مودال، toast

// مساعدة: إظهار toast
function showToast(msg, time=2000){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(()=> t.style.display = 'none', time);
}

// تحميل التمارين من JSON وعرضها في العنصر المحدد
async function loadWorkouts(jsonPath, targetId){
  try{
    const res = await fetch(jsonPath);
    const data = await res.json();
    const target = document.getElementById(targetId);
    if(!target) return;
    target.innerHTML = '';
    data.forEach((day, idx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'workout-card card';
      wrapper.innerHTML = `<h3>${day.name} — <small style="color:var(--muted)">${day.desc}</small></h3>`;
      // جدول
      const table = document.createElement('table');
      table.className = 'table';
      table.innerHTML = `<thead><tr><th>التمرين</th><th>مجموعات</th><th>عدات</th><th>راحة</th><th>أدوات</th><th>إجراءات</th></tr></thead>`;
      const tbody = document.createElement('tbody');
      day.exercises.forEach(ex => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${ex.name}</td><td>${ex.sets}</td><td>${ex.reps}</td><td>${ex.rest}</td><td>${ex.equipment}</td>
          <td class="exercise-actions">
            <button class="details" onclick="openDetails('${escapeHtml(ex.name)}', ${escapeHtmlJSON(ex)})">تفاصيل</button>
            <button class="log" onclick="quickLog('${escapeHtml(ex.name)}')">سجل</button>
          </td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrapper.appendChild(table);
      target.appendChild(wrapper);
    });
  } catch(err){
    console.error(err);
    showToast('خطأ في تحميل التمارين');
  }
}

// فتح مودال تفاصيل التمرين
function openDetails(name, exObj){
  const modal = document.getElementById('modal');
  const body = document.getElementById('modalBody');
  body.innerHTML = `<h3>${name}</h3>
    <p><strong>العضلة:</strong> ${exObj.muscle || '-'}</p>
    <p><strong>الأدوات:</strong> ${exObj.equipment || '-'}</p>
    <p><strong>مجموعات:</strong> ${exObj.sets} • <strong>عدات:</strong> ${exObj.reps} • <strong>راحة:</strong> ${exObj.rest}</p>
    <p class="muted">نصائح: ركز على الشكل الصحيح، تحكم في الحركة، وتنفس بانتظام.</p>`;
  modal.setAttribute('aria-hidden','false');
}
function closeModal(){ const modal=document.getElementById('modal'); if(modal) modal.setAttribute('aria-hidden','true'); }

// تسجيل سريع (تستخدم في workouts.html)
function quickLog(exName){
  const sets = prompt('كم مجموعة نفذت من "'+exName+'"? (أدخل رقم)');
  if(!sets) return;
  const reps = prompt('كم عدد العدات في المتوسط لكل مجموعة؟');
  if(!reps) return;
  saveLog({name:exName, sets:+sets, reps:+reps, ts:Date.now()});
  showToast('تم تسجيل: ' + exName);
  renderLogs();
  // حاول تحديث أي مخطط موجود
  const canvas = document.getElementById('progressChart') || document.getElementById('chartCanvas');
  if(canvas) drawProgressChart(canvas.id || 'progressChart');
}

// حفظ السجل في localStorage
function saveLog(entry){
  const key = 'yasser_logs_v1';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  arr.push(entry);
  localStorage.setItem(key, JSON.stringify(arr));
}

// استرجاع السجلات
function getLogs(){
  return JSON.parse(localStorage.getItem('yasser_logs_v1') || '[]');
}

// عرض السجلات في صفحة المتابعة
function renderLogs(){
  const list = document.getElementById('logsList');
  if(!list) return;
  const logs = getLogs().slice().reverse();
  if(!logs.length){ list.innerHTML = '<p class="muted">لا توجد سجلات بعد.</p>'; return; }
  list.innerHTML = logs.map(l=>{
    const d = new Date(l.ts);
    return `<div class="card" style="margin-bottom:8px;padding:10px">
      <strong>${l.name}</strong> — مجموعات: ${l.sets} — عدات/مجموعة: ${l.reps}
      <div class="muted" style="font-size:12px">${d.toLocaleString()}</div>
    </div>`;
  }).join('');
}

// مسح السجلات
function clearLogs(){
  if(!confirm('هل تريد مسح كل السجلات؟')) return;
  localStorage.removeItem('yasser_logs_v1');
  renderLogs();
  drawProgressChart('progressChart');
  showToast('تم مسح السجلات');
}

// رسم مخطط بسيط على كانفاس (آخر 12 إدخال، نرسم مجموع العدات = sets * reps)
function drawProgressChart(canvasId){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const logs = getLogs();
  const points = logs.slice(-12);
  // إعداد الرسم
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!points.length){
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px Cairo, Tahoma';
    ctx.fillText('لا توجد بيانات للرسم', 20, 40);
    return;
  }
  const padding = 40;
  const w = canvas.width - padding*2;
  const h = canvas.height - padding*2;
  const values = points.map(p => p.sets * p.reps);
  const max = Math.max(...values, 10);
  // محاور
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for(let i=0;i<=4;i++){
    const y = padding + (h/4)*i;
    ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(padding + w, y); ctx.stroke();
  }
  // خط البيانات
  ctx.beginPath();
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  points.forEach((p,i)=>{
    const x = padding + (w/(points.length-1 || 1)) * i;
    const y = padding + h - ( (p.sets * p.reps) / max ) * h;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    // نقطة
    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill();
    // تسمية قصيرة
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Cairo, Tahoma';
    const label = p.name.length>12 ? p.name.slice(0,12)+'…' : p.name;
    ctx.fillText(label, x-20, canvas.height - 8);
  });
  ctx.stroke();
}

// حفظ الوزن من صفحة progress
function saveWeight(){
  const input = document.getElementById('weightInput');
  if(!input) return;
  const v = parseFloat(input.value);
  if(!v) { alert('أدخل قيمة صحيحة'); return; }
  const arr = JSON.parse(localStorage.getItem('yasser_weights_v1') || '[]');
  arr.push({weight:v, ts:Date.now()});
  localStorage.setItem('yasser_weights_v1', JSON.stringify(arr));
  showToast('تم حفظ الوزن');
  renderWeights();
  drawProgressChart('progressChart');
}

// عرض أوزان (اختياري)
function renderWeights(){
  const arr = JSON.parse(localStorage.getItem('yasser_weights_v1') || '[]');
  const logs = document.getElementById('logsList');
  if(!logs) return;
  // نضيف الأوزان في أعلى السجل
  const html = arr.slice().reverse().map(w=>`<div class="card" style="margin-bottom:8px;padding:10px">وزن: <strong>${w.weight} كجم</strong><div class="muted" style="font-size:12px">${new Date(w.ts).toLocaleString()}</div></div>`).join('');
  logs.innerHTML = html + logs.innerHTML;
}

// مساعدة: تحويل كائن إلى JSON آمن داخل onclick
function escapeHtmlJSON(obj){
  return JSON.stringify(obj).replace(/'/g,"\\'");
}
function escapeHtml(s){ return s.replace(/'/g,"\\'"); }

// بحث سريع (يعمل على index إذا كان هناك حقل بحث)
document.addEventListener('DOMContentLoaded', ()=>{
  const search = document.getElementById('searchInput');
  if(search){
    search.addEventListener('input', async (e)=>{
      const q = e.target.value.trim().toLowerCase();
      if(!q) return;
      // جلب البيانات مؤقتًا
      try{
        const res = await fetch('data/workouts.json');
        const data = await res.json();
        const flat = data.flatMap(d => d.exercises.map(ex => ({...ex, day: d.name})));
        const found = flat.filter(x => x.name.toLowerCase().includes(q));
        if(found.length){
          showToast('وجدت ' + found.length + ' نتيجة');
        }
      }catch(err){}
    });
  }
  // تفعيل روابط nav نشطة
  document.querySelectorAll('.main-nav a').forEach(a=>{
    if(location.pathname.endsWith(a.getAttribute('href'))) a.classList.add('active');
  });
});
