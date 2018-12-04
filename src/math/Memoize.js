/*Multiple Argument Memoization*/

function Memoize(options = {}) {
    const {
      stores = [],
        defaultStore = () => {
          let key,
            value,
            Set = false;
          return {
            get: Key => {
              return Set ? (Key === key ? value : undefined) : undefined;
            },
            set: (Key, Value) => {
              (Set = true), (key = Key), (value = Value);
            },
            has: Key => {
              return !!Set && Key === key;
            }
          };
        }
    } = options;
  
    return (fn) => {
      function getNewRecordFor(n) {
        return {
          store: (stores[n] || defaultStore)(),
          result: null
        };
      };
  
      const rootRecord = getNewRecordFor(0);
  
      return (...args) => {
  
        const record = args.reduce(
          (Next, arg, i) => {
            if (!Next.store.has(arg)) {
              Next.store.set(arg, getNewRecordFor(i + 1));
            }
            return Next.store.get(arg);
          }, rootRecord);
  
  
        return (
          record.result ||
          (
            console.log(" next is new "), /*delete this line only for checking memoize functionality*/
            (record.result = ((fn, args) => {
              let called = false;
              let value;
  
              return () => {
                if (!called) {
                  called = true;
                  value = fn(...args);
                }
                return value;
              };
  
            })(fn, args))
          ),
          record.result()
        );
      };
    };
  };
  
  
  /*Example
  console.clear();
  class vec {
    constructor(x, y) {
      this.x = x;
      this.y = y;
  
    }
    log() {
      console.log(this.x + " x " + this.y)
    }
  
  }
  vec.add = Memoize()((a, b) => {
    return new vec(a.x + b.x, a.y + b.y);
  });
  
  let p1 = new vec(10, 20);
  let p2 = new vec(100, 200);
  
  let test = vec.add(p1, p2);
  let test2 = vec.add(p1, p2);
  
  test.log();
  test2.log();
  
  let x = Memoize()(function(c, d) {
    console.log(c + d)
  });
  x(10, 20);
  x(10, 20);
  x(11, 20);
  x(10, 21);
  */
 export { Memoize };