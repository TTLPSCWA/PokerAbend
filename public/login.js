// Das URL-Fragment erreicht den Server nicht. Vor dem Login im lokalen Rücksprungziel erhalten.
'use strict';
const loginNext = document.querySelector('input[name="next"]');
if (loginNext && location.hash) loginNext.value = loginNext.value.split('#')[0] + location.hash;
document.querySelector('#login-language').innerHTML = I18n.selector();
