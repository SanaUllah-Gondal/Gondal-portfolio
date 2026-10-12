const h=document.querySelector('.hero');
h.addEventListener('pointermove',e=>{const r=h.getBoundingClientRect();
h.style.setProperty('--mx',(e.clientX-r.left)+'px');h.style.setProperty('--my',(e.clientY-r.top)+'px')});

const form=document.getElementById('contact-form'),status=document.getElementById('form-status');
form.addEventListener('submit',async e=>{
  e.preventDefault();
  status.className='';status.textContent='Sending...';
  const btn=form.querySelector('button');btn.disabled=true;
  try{
    const res=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(Object.fromEntries(new FormData(form)))});
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||'Something went wrong.');
    form.reset();status.textContent='Message sent. Thank you, I will reply soon.';
  }catch(err){status.className='err';status.textContent=err.message}
  btn.disabled=false;
});
