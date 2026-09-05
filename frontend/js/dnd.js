// ==========================================
// DRAG & DROP ENGINE (Mouse + Touch)
// Shared across Pairing
// ==========================================

let dndState = {
   isDragging: false,
   el: null,
   clone: null,
   startX: 0,
   startY: 0,
   nameNode: null,
   rectWidth: 0,
   rectHeight: 0
};

if (!window.dndInitialized) {
   window.dndInitialized = true;
   
   // --- TOUCH EVENTS (MOBILE) ---
   document.addEventListener('touchstart', (e) => {
       if(e.touches.length > 1) return;
       startDrag(e, e.touches[0].clientX, e.touches[0].clientY, true);
   }, {passive: false});
   
   document.addEventListener('touchmove', (e) => {
       moveDrag(e, e.touches[0].clientX, e.touches[0].clientY, true);
   }, {passive: false});
   
   document.addEventListener('touchend', (e) => {
       const touch = e.changedTouches ? e.changedTouches[0] : e.touches[0];
       endDrag(e, touch.clientX, touch.clientY);
   });
   
   document.addEventListener('touchcancel', (e) => {
       const touch = e.changedTouches ? e.changedTouches[0] : e.touches[0];
       endDrag(e, touch.clientX, touch.clientY);
   });
   
   // --- MOUSE EVENTS (DESKTOP) ---
   document.addEventListener('mousedown', (e) => {
       if (e.button !== 0) return; 
       startDrag(e, e.clientX, e.clientY, false);
   });
   
   document.addEventListener('mousemove', (e) => {
       moveDrag(e, e.clientX, e.clientY, false);
   });
   
   document.addEventListener('mouseup', (e) => {
       endDrag(e, e.clientX, e.clientY);
   });
   
   // --- CORE LOGIC ---
   function startDrag(e, clientX, clientY, isTouch) {
       if(e.target.closest('.remove-x') || e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
       
       let draggable = e.target.closest('.dnd-draggable');
       if(!draggable) return;
       
       // Ensure we are only dragging in intended views
       if(currentActiveView !== 'manual-pairing') return;
       
       dndState.el = draggable;
       dndState.nameNode = dndState.el.querySelector('.main-name-pill') || dndState.el;
       
       const rect = dndState.nameNode.getBoundingClientRect();
       dndState.rectWidth = rect.width;
       dndState.rectHeight = rect.height;
       
       dndState.startX = clientX;
       dndState.startY = clientY;
       dndState.isDragging = false;
   }
   
   function moveDrag(e, clientX, clientY, isTouch) {
       if (!dndState.el) return;
       
       const deltaX = Math.abs(clientX - dndState.startX);
       const deltaY = Math.abs(clientY - dndState.startY);
       
       // If user hasn't triggered drag, check direction of movement
       if (!dndState.isDragging) {
           const threshold = 8;
           
           if (deltaX > threshold && deltaX > deltaY) {
               dndState.isDragging = true;
               
               if(isTouch && navigator.vibrate) navigator.vibrate(20);
               
               dndState.el.classList.add('locked-for-drag');
               
               // Generate visually identical clone
               dndState.clone = dndState.nameNode.cloneNode(true);
               dndState.clone.classList.add('dragging-clone');
               
               // Force size to exact bounding box constraints so centering works perfectly
               dndState.clone.style.width = dndState.rectWidth + 'px';
               dndState.clone.style.height = dndState.rectHeight + 'px';
               dndState.clone.style.margin = '0px';
               
               document.body.appendChild(dndState.clone);
           } else if (deltaY > 8) {
               dndState.el = null;
               return;
           }
       }
       
       if (dndState.isDragging && dndState.clone) {
           if(e.cancelable) e.preventDefault(); 
           
           updateClonePosition(clientX, clientY);
           
           // Highlight valid drop zones depending on the view
           const elAtPoint = document.elementFromPoint(clientX, clientY);
           const activeDz = elAtPoint ? elAtPoint.closest('.dnd-dropzone') : null;
           
           document.querySelectorAll('.dnd-dropzone').forEach(dz => {
               let isValid = false;
               if (currentActiveView === 'manual-pairing' && dz.dataset.role !== undefined && dndState.el.dataset.role !== undefined && dz.dataset.role !== dndState.el.dataset.role) {
                   isValid = true;
               }
               
               if (isValid && dz === activeDz) {
                   dz.classList.add('border-primary', 'bg-blue-50', 'dark:bg-blue-900/30', 'ring-1', 'ring-primary');
               } else {
                   dz.classList.remove('border-primary', 'bg-blue-50', 'dark:bg-blue-900/30', 'ring-1', 'ring-primary');
               }
           });
       }
   }
   
   function endDrag(e, clientX, clientY) {
       if(dndState.el) dndState.el.classList.remove('locked-for-drag');
       
       if (dndState.isDragging && dndState.clone) {
           dndState.clone.remove(); 
           dndState.clone = null; 
           dndState.isDragging = false;
           
           document.querySelectorAll('.dnd-dropzone').forEach(dz => dz.classList.remove('border-primary', 'bg-blue-50', 'dark:bg-blue-900/30', 'ring-1', 'ring-primary'));
           
           const elAtPoint = document.elementFromPoint(clientX, clientY);
           const dropZone = elAtPoint ? elAtPoint.closest('.dnd-dropzone') : null;
           
           if (dropZone && dndState.el) {
               if (currentActiveView === 'manual-pairing') {
                   if (dropZone.dataset.role !== undefined && dndState.el.dataset.role !== undefined && dropZone.dataset.role !== dndState.el.dataset.role) {
                       if (typeof handleManualPairingDrop === 'function') {
                           handleManualPairingDrop(dndState.el.dataset.name, dndState.el.dataset.role, dropZone.dataset.name);
                       }
                   }
               }
           }
       }
       dndState.el = null;
       dndState.nameNode = null;
   }
   
   function updateClonePosition(x, y) {
       if(dndState.clone) {
           const centerX = x - (dndState.rectWidth / 2);
           const centerY = y - (dndState.rectHeight / 2);
           dndState.clone.style.transform = `translate3d(${centerX}px, ${centerY}px, 0px) scale(1.05)`;
       }
   }
}