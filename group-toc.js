'use strict';
(() => {
 const dialog=document.getElementById('toc-dialog');
 if(!dialog||typeof dialog.showModal!=='function')return;
 const image=document.getElementById('toc-dialog-image');
 const heading=document.getElementById('toc-dialog-title');
 const source=document.getElementById('toc-dialog-source');
 const credit=document.getElementById('toc-dialog-credit');
 const status=document.getElementById('toc-dialog-status');
 let opener;
 for(const link of document.querySelectorAll('[data-toc-open]'))link.addEventListener('click',event=>{
  event.preventDefault();opener=link;
  heading.textContent=link.dataset.tocTitle;
  image.alt=link.querySelector('img').alt;
  source.href=link.dataset.tocSource;
  credit.textContent=link.dataset.tocCredit;
  status.textContent='正在加载 TOC…';
  image.onload=()=>{status.textContent='';};
  image.onerror=()=>{status.textContent='图片暂时无法加载，可通过期刊来源查看。';};
  image.src=link.href;
  dialog.showModal();
 });
 dialog.querySelector('[data-toc-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
 dialog.addEventListener('close',()=>opener?.focus());
 for(const thumbnail of document.querySelectorAll('.toc-open img'))thumbnail.addEventListener('error',()=>{
  thumbnail.hidden=true;
  const message=document.createElement('span');message.className='toc-image-error';message.textContent='预览暂不可用，点击查看原图';thumbnail.parentElement.append(message);
 },{once:true});
})();
