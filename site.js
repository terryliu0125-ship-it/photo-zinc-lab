'use strict';
(() => {
 const home=/\/(?:index\.html)?$/.test(location.pathname);
 if(!home)return;
 const routes={'#literature':'literature.html','#library-systems':'literature.html','#mechanism':'principles.html','#mode-controls':'principles.html#mode-controls','#reading-guide':'guide.html','#research':'guide.html#research','#contact':'guide.html#contribute'};
 function routeLegacyLink(){
  const target=/^#paper-L\d+$/.test(location.hash)?'literature.html'+location.hash:routes[location.hash];
  if(target)location.replace(target);
 }
 window.addEventListener('hashchange',routeLegacyLink);
 routeLegacyLink();
})();
