
// inspiration
// > https://www.educative.io/edpresso/how-to-use-the-debounce-function-in-javascript
export function debounce(func: any, wait: any, immediate?: any) {
  var timeout;

  return function executedFunction(...args: any[]) {
    var context = this;

    var later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };

    var callNow = immediate && !timeout;
	
    clearTimeout(timeout);

    timeout = setTimeout(later, wait);
	
    if (callNow) func.apply(context, args);
  };
};