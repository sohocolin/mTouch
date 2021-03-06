/**
 * Created by Administrator on 2017/4/20 0020.
 */
(function (window, document, undefined) {
    var win = window;
    var doc = document;
    var mTouch = function (selector) {
        return new mTouch.prototype.init(selector);
    }
    mTouch.prototype = {
        constructor: mTouch,
        length: 0,
        selector: '',
        init: function (selector) {
            var elm;
            //当没有选择的dom元素时，返回对象本身 mTouch(),mTouch(null)
            if (!selector) {
                return this;
            }
            if (typeof selector == 'object') {
                var selector = [selector];
                for (var i = 0; i < selector.length; i++) {
                    this[i] = selector[i];
                }
                this.length = selector.length;
                return this;
            } else if (typeof selector == 'function') {
                mTouch.ready(selector);
                return;
            }

            if (selector.charAt(0) == '#' && !selector.match('\\s')) {
                this.selector = selector;
                selector = selector.substring(1);
                elm = doc.getElementById(selector);
                this[0] = elm;
                this.length = 1;
                return this;
            } else {
                elm = doc.querySelectorAll(selector);
                var len = elm.length;
                for (var i = 0; i < len; i++) {
                    this[i] = elm[i];
                }
                this.selector = selector;
                this.length = len;
                return this;
            }
        },
        each: function (callback) {
            return mTouch.each(this, callback)
        },
        css: function (attr, val) {
            for (var i = 0; i < this.length; i++) {
                if (typeof attr == 'string') {
                    console.log(attr);
                    if (arguments.length == 1) {
                        return getComputedStyle(this[i], null)[attr];
                    }
                    this[i].style[attr] = val;
                } else {
                    var _this = this[i];
                    mTouch.each(attr, function (attr, val) {
                        _this.style.cssText += '' + attr + ':' + val + ';'
                    })
                }
            }
            return this;
        },
        eq: function (num) {
            var num = num < 0 ? (this.length - 1) : num;
            return new mTouch(this[num]);
        }
    }

    mTouch.prototype.init.prototype = mTouch.prototype;

    /**
     ** touch部分
     * */

    function swipeDirection(x1, x2, y1, y2) {
        return Math.abs(x1 - x2) >= Math.abs(y1 - y2) ? (x1 - x2 > 0 ? 'left' : 'right') : (y1 - y2 > 0 ? 'up' : 'down');
    }
    //事件代理用的函数

    function delegate(agent, type, selector, fn) {
        //为了复杂的选择器实现
        if (typeof selector != "string") {
            for (var i = 0; i < agent.length; i++) {
                agent[i].addEventListener(type, fn, false);
            }
            return;
        }
        agent[0].addEventListener(type, function(e) {
            var target = e.target;
            var ctarget = e.currentTarget;
            var bubble = true;
            while (bubble && target != ctarget) {
                if (filiter(agent, selector, target)) {
                    bubble = fn.call(target, e); //要吧事件e返回出去调用
                }
                target = target.parentNode;
            }
            return bubble;
        }, false);

        function filiter(agent, selector, target) {
            var nodes = agent[0].querySelectorAll(selector);
            for (var i = 0; i < nodes.length; i++) {
                if (nodes[i] == target) {
                    return true;
                }
            }
        }
    }
    //事件代理用的函数结束

    function eTouch(root, selector, fn) {
        this.root = document.querySelectorAll(root); //root委托元素
        if (!this.root) {
            console.log('root不存在');
            return;
        }

        this.target = {//当前点击的对象
            el : null,
            w : null,
            h : null
        };
        this.touchObj = {
            status: '',
            pageX: 0,
            pageY: 0,
            clientX: 0,
            clientY: 0,
            distanceX: 0,
            distanceY: 0
        };
        this.isTap = false; //用来判断是否为tap
        this.time = 0; //记录点击的时间间隔
        this.selector = selector;
        this.Event = []; //存放上下左右滑的回调事件
        this.count = 0;
        this.p = 0;
        this.clock = null; //给div加锁,完全阻止默认行为
        if (arguments[2] == undefined) {
            this.operate(arguments[1]);
            if(String(arguments[1]).indexOf('e.clock') > 1)
                this.clock = false;
        } else {
            this.operate(arguments[2]);
            if(String(arguments[2]).indexOf('e.clock') > 1)
                this.clock = false;
        }
    }

    eTouch.prototype.init = function() {
        this.touchObj.distanceX = 0;
        this.touchObj.distanceY = 0;
    }
    eTouch.prototype.operate = function(fn) {
        var touchObj = this.touchObj, //缓存touchObj
            isTap = this.isTap,
            _this = this;
        delegate(this.root, 'touchstart', this.selector, function(e) {
            _this.target.el = this; //存储点击对象是谁
            _this.target.w = this.getBoundingClientRect().width;
            _this.target.h = this.getBoundingClientRect().height;
            touchStart(e, touchObj, _this);
        });
        delegate(this.root, 'touchmove', this.selector, function(e) {
            touchMove(e, _this.target, touchObj, _this);
        });
        delegate(this.root, 'touchend', this.selector, function(e) {
            touchEnd(e, this, touchObj, _this, fn);
        });
        return this;
    }
    eTouch.prototype.trigger = function(type, e) {
        for (var i = 0; i < this.Event.length; i++) {
            if (this.Event[i].type == type) {
                this.Event[i].method.call(this.target.el,e, this.touchObj);
            }
        }
        return this;
    }
    eTouch.prototype.on = function(type, fn) {
        this.Event.push({
            type: type,
            method: fn
        })
        return this;
    }

    //把3个状态提取出来
    function touchStart(e, touchObj, module) {
        module.init(); //滑动或者点击结束要初始化
        var touches = e.touches[0];
        //赋值手指初始位置
        touchObj.pageX = touches.pageX;
        touchObj.pageY = touches.pageY;
        touchObj.clientX = touches.clientX;
        touchObj.clientY = touches.clientY;
        module.time = +new Date();
    }

    function touchMove(e, target, touchObj, module) {
        var touches = e.touches[0];
        touchObj.status = 'swiper';
        //计算手指移动位置
        touchObj.distanceX = touches.pageX - touchObj.pageX;
        touchObj.distanceY = touches.pageY - touchObj.pageY;
        /*
         * 以下是
         * 手指划过微积分算法
         * */
        module.count++;
        module.p = module.p + 0.5 * touchObj.distanceY * touchObj.distanceY / touchObj.distanceX;
        var pAvg = module.p / module.count;
        var touchS = (2/3) * (2 * pAvg * touchObj.distanceX) * Math.sqrt(2 * pAvg * touchObj.distanceX);

        var targetH = target.h;
        var targetW = target.w;
        var targetS = 0;
        if((targetH / targetW) > 0.1405) { //触摸的元素宽高比问题,选择了tan8°做标准
            targetS = (2/3) * (Math.abs(touchObj.distanceX) * targetW * 0.0197) * Math.sqrt( Math.abs(touchObj.distanceX) * targetW * 0.0197 );
        } else {
            targetS = (2/3) * ( targetH * targetH * Math.abs(touchObj.distanceX) / targetW) * Math.sqrt( targetH * targetH * Math.abs(touchObj.distanceX) / targetW);
        }

        /*
         * 以上是
         * 手指划过微积分算法
         * */
        //console.log(touchS,'手指曲线');
        //console.log(targetS,'目标曲线');
        if(module.clock == false) {
            e.preventDefault();
            module.trigger(touchObj.status, e, touchObj);
        }
        if (touchS < targetS ) {
            e.preventDefault();
            module.trigger(touchObj.status, e, touchObj);
        }
    }

    function touchEnd(e, target, touchObj, module, fn) {
        var touches = e.changedTouches[0];
        var time = +new Date() - module.time;
        touchObj.distanceX = touches.pageX - touchObj.pageX;
        touchObj.distanceY = touches.pageY - touchObj.pageY;
        //计算手指滑动方向
        var x1 = touchObj.pageX;
        var x2 = touchObj.pageX + touchObj.distanceX;
        var y1 = touchObj.pageY;
        var y2 = touchObj.pageY + touchObj.distanceY;
        touchObj.status = swipeDirection(x1, x2, y1, y2);

        //当手指触摸时间＜150和位移小于2px则为tap事件
        if (time < 150 && Math.abs(touchObj.distanceX) < 2 && Math.abs(touchObj.distanceY) < 2) {
            module.isTap = true;
            if (module.isTap) {
                touchObj.status = 'tap';
                //返二个参数 指向被触发的dom，和当前构造函数
                setTimeout(function() {
                    module.isTap = false;
                    fn.call(target, e, touchObj);
                }, 30);
            }
        } else { //否则为滑动或者双击，双击暂不想做
            module.trigger(touchObj.status, e, touchObj);
        }
        module.count = 0;
        module.p = 0;
    }
    /**
     *
     * @param obj
     * @param callback
     */
    mTouch.touch=function(root,selector,fn){
        return new eTouch(root, selector, fn);
    }
    mTouch.each = function (obj, callback) {
        var length, i = 0;
        if (mTouch.isArray(obj)) {
            length = obj.length;
            for (; i < length; i++) {
                if (callback.call(obj[i], i, obj[i]) === false) {
                    break;
                }
            }
        } else {
            for (i in obj) {
                if (callback.call(obj[i], i, obj[i]) === false) {
                    break;
                }
            }
        }
        return obj;
    }
    /*document ready*/
    mTouch.ready = function (fn) {
        if (document.readyState === 'complete' || document.readyState !== 'loading') {
            fn && fn()
        } else {
            document.addEventListener('DOMContentLoaded', fn);
        }
    }
    /**
     *
     * @type {string[]}
     * 检测参数类型 常用的公用方法
     */
    var rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;
    mTouch.trim = function (text) {
        return text == null ?
            "" :
            ( text + "" ).replace(rtrim, "");
    };
    var ArrayProto = Array.prototype,
        ObjProto = Object.prototype;

    var toString = ObjProto.toString,
        hasOwnProperty = ObjProto.hasOwnProperty;

    var checkTypeArr = ['Arguments', 'Array', 'Function', 'String', 'Number', 'Date', 'RegExp'];
    checkTypeArr.forEach(function (type, i) {
        mTouch['is' + type] = function (obj) {
            return toString.call(obj) === '[object ' + type + ']';
        }
    });
    window.mTouch = mTouch;
})(window, document, undefined);