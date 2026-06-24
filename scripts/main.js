// Central frontend logic for forms and testimonials
(function(){
  const CONFIG = window.__TECHNOVA_CONFIG__ || {};
  const MSG_KEY = 'technova_messages';
  const BOOK_KEY = 'technova_bookings';
  const TEST_KEY = 'technova_testimonials';

  function safeParse(key){ try{ return JSON.parse(localStorage.getItem(key)||'null')||[] }catch(e){return[]} }
  function saveArray(key, arr){ localStorage.setItem(key, JSON.stringify(arr)); }

  function showToast(msg, timeout=3000){
    const t = document.createElement('div');
    t.className = 'tn-toast'; t.textContent = msg;
    Object.assign(t.style,{position:'fixed',right:'20px',bottom:'20px',background:'#0f172a',color:'#fff',padding:'10px 14px',borderRadius:'10px',boxShadow:'0 6px 20px rgba(2,6,23,0.2)',zIndex:9999});
    document.body.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(),300); }, timeout);
  }

  async function postIfConfigured(path, data){
    const url = CONFIG.endpoint && (CONFIG.endpoint.replace(/\/$/,'') + path);
    if(!url) return {ok:false, reason:'no-endpoint'};
    try{
      const res = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
      return res.ok? {ok:true, status:res.status} : {ok:false, status: res.status};
    }catch(e){ return {ok:false, reason:e.message}; }
  }

  // Contact form handler
  function initContact(){
    const form = document.getElementById('contact-form');
    if(!form) return;
    form.addEventListener('submit', async function(e){
      e.preventDefault();
      const name = form.querySelector('#name').value.trim();
      const email = form.querySelector('#email').value.trim();
      const phone = form.querySelector('#phone').value.trim();
      const message = form.querySelector('#message').value.trim();
      if(!name || !email || !message){ showToast('Please complete required fields'); return; }

      const payload = {name,email,phone,message,submitted:new Date().toISOString(), source: 'contact'};
      // save locally for admin demo
      const arr = safeParse(MSG_KEY); arr.unshift(payload); saveArray(MSG_KEY, arr);

      // attempt backend POST
      const res = await postIfConfigured('/contact', payload);
      if(res.ok){ showToast('Message sent successfully'); form.reset(); }
      else if(res.reason === 'no-endpoint'){
        // fallback to mailto
        const subject = encodeURIComponent('Website Contact Form');
        const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\nMessage:\n${message}`);
        window.location.href = `mailto:abdulaiposuwa7@gmail.com?subject=${subject}&body=${body}`;
      } else { showToast('Error sending message, saved locally'); form.reset(); }
    });
  }

  // Booking page/form handler
  function initBooking(){
    const form = document.getElementById('booking-page-form') || document.getElementById('booking-form');
    if(!form) return;

    const payNowCheckbox = form.querySelector('#pay-now');
    const paypalSection = document.getElementById('paypal-section');
    const serviceSelect = form.querySelector('#booking-service');

    // Show/hide PayPal button when checkbox is toggled
    if(payNowCheckbox && paypalSection){
      payNowCheckbox.addEventListener('change', function(){
        paypalSection.style.display = this.checked ? 'block' : 'none';
        if(this.checked){
          initPayPalButton();
        }
      });
    }

    form.addEventListener('submit', async function(e){
      e.preventDefault();
      // support multiple id names
      const name = (form.querySelector('#booking-name') || form.querySelector('#name'))?.value?.trim() || '';
      const email = (form.querySelector('#booking-email') || form.querySelector('#email'))?.value?.trim() || '';
      const phone = (form.querySelector('#booking-phone') || form.querySelector('#phone'))?.value?.trim() || '';
      const service = (form.querySelector('#booking-service') || form.querySelector('#service'))?.value || '';
      const date = (form.querySelector('#booking-date-page') || form.querySelector('#booking-date'))?.value || '';
      const message = (form.querySelector('#booking-message-page') || form.querySelector('#booking-message'))?.value?.trim() || '';
      const isPaying = (form.querySelector('#pay-now')?.checked) || false;

      if(!service || !date) { showToast('Please choose a service and date'); return; }

      // If payment is enabled, require PayPal approval
      if(isPaying && !window.__BOOKING_PAID__){
        showToast('Please complete PayPal payment before submitting.');
        return;
      }

      const payload = {name,email,phone,service,date,message,submitted:new Date().toISOString(), source:'booking', paid: isPaying};
      const arr = safeParse(BOOK_KEY); arr.unshift(payload); saveArray(BOOK_KEY, arr);

      const res = await postIfConfigured('/booking', payload);
      if(res.ok){ showToast('Booking request sent'); }
      else if(res.reason === 'no-endpoint'){
        showToast('Booking saved locally; admin can review it in the dashboard.');
      } else {
        showToast('Saved booking locally (no backend)');
      }

      form.reset();
      if(paypalSection) paypalSection.style.display = 'none';
      window.__BOOKING_PAID__ = false;
      setTimeout(function(){ window.location.href = 'admin.html'; }, 900);
    });
  }

  function initPayPalButton(){
    const container = document.getElementById('paypal-button-container');
    if(!container || !window.paypal) return;

    // Clear previous render
    container.innerHTML = '';

    // Note: This is a demo. In production, replace with real PayPal Client ID
    window.paypal.Buttons({
      createOrder: function(data, actions){
        return actions.order.create({
          purchase_units: [{
            amount: { value: '50.00' } // Fixed booking fee; in production, calculate based on service
          }]
        });
      },
      onApprove: function(data, actions){
        return actions.order.capture().then(function(orderData){
          window.__BOOKING_PAID__ = true;
          showToast('Payment successful! You can now submit your booking.');
        });
      },
      onError: function(err){
        console.error(err);
        showToast('Payment error. Please try again.');
      }
    }).render('#paypal-button-container');
  }

  // Testimonials submit & render
  function initTestimonials(){
    const tform = document.getElementById('testimonial-form');
    if(tform){
      tform.addEventListener('submit', function(e){
        e.preventDefault();
        const name = document.getElementById('t-name').value.trim();
        const role = document.getElementById('t-role').value.trim();
        const message = document.getElementById('t-message').value.trim();
        if(!name || !message) { showToast('Please provide name and message'); return; }
        const arr = safeParse(TEST_KEY); arr.unshift({name,role,message,date:new Date().toISOString()}); saveArray(TEST_KEY, arr);
        renderTestimonials();
        showToast('Thank you — your review was submitted.');
        tform.reset();
      });
    }
    renderTestimonials();
  }

  function renderTestimonials(){
    const container = document.getElementById('all-testimonials') || document.getElementById('testimonials-list');
    if(!container) return;
    const list = safeParse(TEST_KEY);
    container.innerHTML = '';
    const avatars = ['images/avatar1.svg','images/avatar2.svg'];
    list.slice(0,10).forEach((t,i)=>{
      const block = document.createElement('blockquote');
      const avatar = avatars[i % avatars.length];
      const safeMsg = (t.message||'').replace(/</g,'&lt;');
      const name = (t.name||'Anonymous');
      const role = t.role? (', ' + t.role) : '';
      block.innerHTML = `<p>"${safeMsg}"</p><div class="testimonial-meta"><img class="testimonial-avatar" src="${avatar}" alt="avatar"><cite>— ${name}${role}</cite></div>`;
      container.appendChild(block);
    });
  }

  function getQueryParam(name){
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function initLucideIcons(){
    if(window.lucide && typeof lucide.replace === 'function'){
      lucide.replace({ width: 22, height: 22, strokeWidth: 2 });
    }
  }

  function initServiceBookingLinks(){
    const buttons = document.querySelectorAll('.book-now');
    const formService = document.getElementById('booking-service');
    const bookingSection = document.getElementById('service-booking');
    buttons.forEach(button=>{
      button.addEventListener('click', function(){
        const service = button.dataset.service;
        if(formService){
          formService.value = service;
        }
        if(bookingSection){
          bookingSection.scrollIntoView({behavior:'smooth', block:'start'});
        }
      });
    });
  }

  function prefillBookingFromQuery(){
    const service = getQueryParam('service');
    const formService = document.getElementById('booking-service') || document.getElementById('service');
    if(service && formService){
      formService.value = service;
      const bookingSection = document.getElementById('service-booking');
      if(bookingSection){ bookingSection.scrollIntoView({behavior:'smooth', block:'start'}); }
    }
  }

  // Scroll animations: observe elements and fade them in as they enter viewport
  function initScrollAnimations(){
    if(!('IntersectionObserver' in window)) return; // fallback for older browsers
    const observer = new IntersectionObserver(function(entries){
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, {threshold: 0.1, rootMargin: '0px 0px -50px 0px'});

    // Observe all cards, service items, testimonials, form groups
    document.querySelectorAll('.service-card, .resource-card, .testimonial-grid blockquote, .service-list li, .form-group, section h2, .booking-summary, .academy-preview').forEach((el, i)=>{
      el.classList.add('delay-' + (i % 3));
      observer.observe(el);
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    initContact();
    initBooking();
    initTestimonials();
    initScrollAnimations();
    initServiceBookingLinks();
    prefillBookingFromQuery();
    initLucideIcons();
  });

})();
