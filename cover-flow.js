/* Cover Flow — vanilla, multi-instance. Scans [data-cf] containers.
   Each container: .cf-stage > .cf-card* (each card holds an <image-slot>),
   plus .cf-ui with .cf-prev / .cf-dots / .cf-next.
   Side card click -> center it. Center card (when its slot is filled) shows a
   zoom button -> window.openImage(src). Drag / wheel / buttons / dots move it.
   Gentle auto-drift, pausing ~5s after any manual interaction. */
(function(){
  function init(cf){
    var stage=cf.querySelector('.cf-stage');
    var cards=[].slice.call(stage.querySelectorAll('.cf-card'));
    if(!cards.length) return;

    // PHONE: skip the heavy 3D cover flow — use a native swipeable photo strip (CSS),
    // each photo taps to open the lightbox; the lightbox can then swipe/arrow between photos.
    if(window.matchMedia && window.matchMedia('(max-width:720px)').matches){
      cf.classList.add('cf-mobile');
      // step order matches the visual strip (by data-n ascending)
      var ordered=cards.slice().sort(function(a,b){
        return (parseInt(a.getAttribute('data-n'),10)||0)-(parseInt(b.getAttribute('data-n'),10)||0);
      });
      function mSrc(card){var img=card.querySelector('img.cf-img');
        return img&&!(img.complete&&img.naturalWidth===0)?img.getAttribute('src'):null;}
      var mIdx=0;
      var mApi={
        step:function(delta){var na=Math.max(0,Math.min(ordered.length-1,mIdx+delta));
          if(na===mIdx)return false;mIdx=na;var s=mSrc(ordered[mIdx]);
          if(s&&window.openImage)window.openImage(s);return true;},
        atStart:function(){return mIdx<=0;},
        atEnd:function(){return mIdx>=ordered.length-1;}
      };
      cards.forEach(function(card){
        card.style.cursor='zoom-in';
        card.addEventListener('click',function(){
          var s=mSrc(card);if(!s)return;
          mIdx=ordered.indexOf(card);
          window.__cfActive=mApi;
          if(window.openImage)window.openImage(s);
        });
      });
      return;
    }

    var N=cards.length;
    var active=Math.floor((N-1)/2);
    var dotsWrap=cf.querySelector('.cf-dots');
    var dots=[];

    // resolve the displayable photo src for a card (fixed <img> or filled image-slot)
    function cardSrc(card){
      var img=card.querySelector('img.cf-img');
      if(img&&!img.classList.contains('cf-miss')&&img.getAttribute('src')
         &&!(img.complete&&img.naturalWidth===0)) return img.getAttribute('src');
      var slot=card.querySelector('image-slot');
      if(slot&&slot.hasAttribute('data-filled')){
        var im=slot.shadowRoot&&slot.shadowRoot.querySelector('img[part="image"]');
        return im&&im.getAttribute('src');
      }
      return null;
    }
    function enlarge(card){ var s=cardSrc(card); if(s&&window.openImage){ window.__cfActive=api; window.openImage(s); } }

    // navigation API for the lightbox (arrow keys / on-screen arrows)
    var api={
      step:function(delta){
        var na=Math.max(0,Math.min(N-1,active+delta));
        if(na===active) return false;       // at an end — no wrap
        active=na; layout(); poke();
        var s=cardSrc(cards[active]); if(s&&window.openImage) window.openImage(s);
        return true;
      },
      atStart:function(){ return active<=0; },
      atEnd:function(){ return active>=N-1; }
    };

    cards.forEach(function(card,i){
      // overlay that captures clicks on non-center cards to center them;
      // clicking the centered card enlarges its photo
      var hit=document.createElement('div'); hit.className='cf-hit';
      hit.addEventListener('click',function(){ if(moved) return;
        if(i===active){ enlarge(card); } else { setActive(i); poke(); } });
      card.appendChild(hit);
      // zoom button (center + filled only, via CSS) -> enlarge
      var zoom=document.createElement('button'); zoom.className='cf-zoom'; zoom.setAttribute('aria-label','Enlarge');
      zoom.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
      zoom.addEventListener('click',function(e){ e.stopPropagation(); enlarge(card); });
      card.appendChild(zoom);
      if(dotsWrap){
        var d=document.createElement('button'); d.className='cf-dot';
        d.addEventListener('click',function(){ setActive(i); poke(); });
        dotsWrap.appendChild(d); dots.push(d);
      }
    });

    function layout(){
      var CW=cf.clientWidth||600;
      var CH=cf.clientHeight||360;
      // size cards to the container: bounded by width (so the outermost visible card
      // never covers the left column) AND by height (so a taller flow grows the cards)
      var cardW=Math.max(150,Math.min(430,Math.min((CW/2-10)/1.1,(CH*0.62)*260/174)));
      var cardH=Math.round(cardW*174/260);
      var step1=cardW*0.54, stepN=cardW*0.17;
      cards.forEach(function(card,i){
        card.style.width=cardW+'px'; card.style.height=cardH+'px';
        card.style.marginLeft=(-cardW/2)+'px'; card.style.marginTop=(-cardH/2)+'px';
        var slot=card.querySelector('image-slot');
        if(slot){ slot.style.width=cardW+'px'; slot.style.height=cardH+'px'; }
        card.style.cursor=(i===active)?(cardSrc(card)?'zoom-in':'default'):'pointer';
        var off=i-active, abs=Math.abs(off), sign=off<0?-1:1, x,ry,tz,sc;
        if(off===0){ x=0; ry=0; tz=36; sc=1; }
        else { x=sign*(step1+(abs-1)*stepN); ry=-sign*54; tz=-72-(abs-1)*42; sc=Math.max(0.5,0.82-(abs-1)*0.05); }
        card.style.transform='translateX('+x+'px) translateZ('+tz+'px) rotateY('+ry+'deg) scale('+sc+')';
        card.style.zIndex=String(100-abs);
        card.style.opacity=abs>3?'0':'1';
        card.style.pointerEvents=abs>3?'none':'auto';
        card.style.filter=off===0?'none':'brightness(0.74) saturate(0.92)';
        card.classList.toggle('is-center',off===0);
      });
      dots.forEach(function(d,j){ d.classList.toggle('on',j===active); });
    }
    function setActive(i){ active=Math.max(0,Math.min(N-1,i)); layout(); }

    var prev=cf.querySelector('.cf-prev'), next=cf.querySelector('.cf-next');
    if(prev) prev.addEventListener('click',function(){ setActive(active-1); poke(); });
    if(next) next.addEventListener('click',function(){ setActive(active+1); poke(); });

    // drag
    var dragX=null, base=0, moved=false;
    cf.addEventListener('pointerdown',function(e){ dragX=e.clientX; base=active; moved=false; pauseUntil=Infinity; });
    window.addEventListener('pointermove',function(e){
      if(dragX===null) return;
      var dx=e.clientX-dragX; if(Math.abs(dx)>6) moved=true;
      var na=Math.max(0,Math.min(N-1,base+Math.round(-dx/110)));
      if(na!==active){ active=na; layout(); }
    });
    window.addEventListener('pointerup',function(){ if(dragX!==null){ dragX=null; poke(); setTimeout(function(){ moved=false; },30); } });

    // wheel
    var wlock=false;
    cf.addEventListener('wheel',function(e){
      var d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
      if(Math.abs(d)<8) return; e.preventDefault();
      if(wlock) return; wlock=true; setTimeout(function(){ wlock=false; },200);
      setActive(active+(d>0?1:-1)); poke();
    },{passive:false});

    // keep deck touch-swipe from firing when interacting with the flow
    ['touchstart','touchmove','touchend'].forEach(function(ev){
      cf.addEventListener(ev,function(e){ e.stopPropagation(); },{passive:true});
    });

    // gentle auto-drift, pauses ~5s after manual interaction
    var dir=1, pauseUntil=0;
    function poke(){ pauseUntil=Date.now()+5000; }
    setInterval(function(){
      if(document.body.getAttribute('data-lightbox')==='1') return;
      if(Date.now()<pauseUntil) return;
      if(active>=N-1) dir=-1; else if(active<=0) dir=1;
      setActive(active+dir);
    },2200);

    layout();
    window.addEventListener('resize',layout);
  }
  function boot(){ [].slice.call(document.querySelectorAll('[data-cf]')).forEach(init); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
/* build: cover-flow ready */
