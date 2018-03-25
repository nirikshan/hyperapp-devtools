var state = {
    runs: {},
    logs: [],
    paneDisplay: "right",
    valueDisplay: "state",
    paneShown: false,
    selectedAction: null,
    collapseRepeatingActions: true
};

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */



var __assign = Object.assign || function __assign(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
    }
    return t;
};

/**
 * Get the value at the given path in the given target, or undefined if path doesn't exists.
 */
function get(target, path) {
    path = typeof path === "string" ? path.split(".") : path;
    var result = target;
    for (var i = 0; i < path.length; i++) {
        result = result ? result[path[i]] : result;
    }
    return result;
}
/**
 * Immutable set: set the value at the given path in the given target and returns a new target.
 * Creates the necessary objects/arrays if the path doesn't exist.
 */
function set(target, path, value) {
    path = typeof path === "string" ? path.split(".") : path;
    if (path.length === 0) {
        return value;
    }
    return assign(Array.isArray(target) ? [] : {}, target, (_a = {},
        _a[path[0]] = path.length > 1 ? set(target[path[0]] || {}, path.slice(1), value) : value,
        _a));
    var _a;
}
/**
 * Immutable merge: merges the given value and the existing value (if any) at the path in the target using Object.assign() and return a new target.
 * Creates the necessary objects/arrays if the path doesn't exist.
 */
function merge(target, path, value) {
    return set(target, path, assign(Array.isArray(value) ? [] : {}, get(target, path), value));
}
function assign(target, obj, obj2) {
    for (var i in obj) {
        target[i] = obj[i];
    }
    for (var i in obj2) {
        target[i] = obj2[i];
    }
    return target;
}

function mergeResult(state, event) {
    if (event && event.result) {
        var action = event.action.split(".");
        action.pop();
        return merge(state, action, event.result);
    }
    return state;
}
/**
 * Recursively goes down the tree of actions and append the given event to the last non-done action.
 *
 */
function appendAction(previousAction, event) {
    if (previousAction.done) {
        return previousAction;
    }
    // no nested action yet
    if (previousAction.nestedActions.length === 0) {
        if (!event.callDone) {
            // the action calls to a nested action
            var nestedAction = {
                name: event.action,
                done: false,
                collapsed: false,
                actionData: event.data,
                nestedActions: [],
                previousState: previousAction.previousState
            };
            return __assign({}, previousAction, { nestedActions: [nestedAction] });
        }
        else if (previousAction.name === event.action) {
            // the previous call is now complete: set to done and compute the result
            return __assign({}, previousAction, { done: true, actionResult: event.result, nextState: mergeResult(previousAction.previousState, event) });
        }
        else {
            // error case
            console.log("Previous action is done and event.callDone", previousAction, event);
            // TODO what to return?!
            return previousAction;
        }
    }
    else {
        // there are already some nested actions: call recursivelly
        var nested = previousAction.nestedActions;
        var nestedAction = nested[nested.length - 1];
        var newNestedAction = appendAction(nestedAction, event);
        if (nestedAction === newNestedAction) {
            return previousAction;
        }
        return __assign({}, previousAction, { nestedActions: nested.slice(0, nested.length - 1).concat(newNestedAction) });
    }
}
var actions = {
    log: function (event) { return function (state) {
        return { logs: state.logs.concat([event]) };
    }; },
    logInit: function (event) { return function (state) {
        var runs = __assign({}, state.runs);
        var action = {
            name: "Initial State",
            done: true,
            collapsed: false,
            nestedActions: [],
            previousState: null,
            nextState: event.state
        };
        runs[event.runId] = {
            id: event.runId,
            timestamp: event.timestamp,
            actions: [action],
            collapsed: false
        };
        return { runs: runs, selectedAction: action };
    }; },
    logAction: function (event) { return function (state) {
        var runs = __assign({}, state.runs);
        var run = runs[event.runId];
        var actions = run.actions.slice();
        run.actions = actions;
        var prevAction = actions.pop();
        var selectedAction;
        if (prevAction.done) {
            // previous action done: create new action and append
            if (!event.callDone) {
                selectedAction = {
                    done: false,
                    collapsed: false,
                    nestedActions: [],
                    name: event.action,
                    actionData: event.data,
                    previousState: prevAction.nextState
                };
                actions.push(prevAction, selectedAction);
            }
            else {
                // error!, should we log it here?
                console.log("Previous action is done and event.callDone", state, event);
            }
        }
        else {
            // previous action not done: find parent action, create and append
            selectedAction = appendAction(prevAction, event);
            actions.push(selectedAction);
        }
        return { runs: runs, selectedAction: selectedAction };
    }; },
    toggleRun: function (id) { return function (state) {
        var runs = __assign({}, state.runs);
        runs[id] = __assign({}, runs[id], { collapsed: !runs[id].collapsed });
        return { runs: runs };
    }; },
    toggleAction: function (payload) { return function (state) {
        var run = payload.run, actionId = payload.actionId;
        var path = [run, "actions", actionId, "collapsed"];
        var collapsed = get(state.runs, path);
        var runs = set(state.runs, path, !collapsed);
        return { runs: runs };
    }; },
    select: function (selectedAction) {
        return { selectedAction: selectedAction };
    },
    showPane: function (paneShown) {
        return { paneShown: paneShown };
    },
    setPaneDisplay: function (paneDisplay) {
        return { paneDisplay: paneDisplay };
    },
    setValueDisplay: function (valueDisplay) {
        return { valueDisplay: valueDisplay };
    },
    toggleCollapseRepeatingActions: function () { return function (state) {
        return { collapseRepeatingActions: !state.collapseRepeatingActions };
    }; },
    deleteRun: function (id) { return function (state) {
        var runs = __assign({}, state.runs);
        delete runs[id];
        return { runs: runs };
    }; }
};

function h(name, attributes) {
  var rest = [];
  var children = [];
  var length = arguments.length;

  while (length-- > 2) rest.push(arguments[length]);

  while (rest.length) {
    var node = rest.pop();
    if (node && node.pop) {
      for (length = node.length; length--; ) {
        rest.push(node[length]);
      }
    } else if (node != null && node !== true && node !== false) {
      children.push(node);
    }
  }

  return typeof name === "function"
    ? name(attributes || {}, children)
    : {
        nodeName: name,
        attributes: attributes || {},
        children: children,
        key: attributes && attributes.key
      }
}

function styleInject(css, ref) {
  if ( ref === void 0 ) ref = {};
  var insertAt = ref.insertAt;

  if (!css || typeof document === 'undefined') { return; }

  var head = document.head || document.getElementsByTagName('head')[0];
  var style = document.createElement('style');
  style.type = 'text/css';

  if (insertAt === 'top') {
    if (head.firstChild) {
      head.insertBefore(style, head.firstChild);
    } else {
      head.appendChild(style);
    }
  } else {
    head.appendChild(style);
  }

  if (style.styleSheet) {
    style.styleSheet.cssText = css;
  } else {
    style.appendChild(document.createTextNode(css));
  }
}

var css = "/*! Spectre.css v0.5.1 | MIT License | github.com/picturepan2/spectre */\n/* Manually forked from Normalize.css */\n/* normalize.css v5.0.0 | MIT License | github.com/necolas/normalize.css */\n/**\n * 1. Change the default font family in all browsers (opinionated).\n * 2. Correct the line height in all browsers.\n * 3. Prevent adjustments of font size after orientation changes in\n *    IE on Windows Phone and in iOS.\n */\n/* Document\n   ========================================================================== */\nhtml {\n  font-family: sans-serif;\n  /* 1 */\n  -ms-text-size-adjust: 100%;\n  /* 3 */\n  -webkit-text-size-adjust: 100%;\n  /* 3 */ }\n\n/* Sections\n   ========================================================================== */\n/**\n * Remove the margin in all browsers (opinionated).\n */\nbody {\n  margin: 0; }\n\n/**\n * Add the correct display in IE 9-.\n */\narticle,\naside,\nfooter,\nheader,\nnav,\nsection {\n  display: block; }\n\n/**\n * Correct the font size and margin on `h1` elements within `section` and\n * `article` contexts in Chrome, Firefox, and Safari.\n */\nh1 {\n  font-size: 2em;\n  margin: 0.67em 0; }\n\n/* Grouping content\n   ========================================================================== */\n/**\n * Add the correct display in IE 9-.\n * 1. Add the correct display in IE.\n */\nfigcaption,\nfigure,\nmain {\n  /* 1 */\n  display: block; }\n\n/**\n * Add the correct margin in IE 8 (removed).\n */\n/**\n * 1. Add the correct box sizing in Firefox.\n * 2. Show the overflow in Edge and IE.\n */\nhr {\n  box-sizing: content-box;\n  /* 1 */\n  height: 0;\n  /* 1 */\n  overflow: visible;\n  /* 2 */ }\n\n/**\n * 1. Correct the inheritance and scaling of font size in all browsers. (removed)\n * 2. Correct the odd `em` font sizing in all browsers.\n */\n/* Text-level semantics\n   ========================================================================== */\n/**\n * 1. Remove the gray background on active links in IE 10.\n * 2. Remove gaps in links underline in iOS 8+ and Safari 8+.\n */\na {\n  background-color: transparent;\n  /* 1 */\n  -webkit-text-decoration-skip: objects;\n  /* 2 */ }\n\n/**\n * Remove the outline on focused links when they are also active or hovered\n * in all browsers (opinionated).\n */\na:active,\na:hover {\n  outline-width: 0; }\n\n/**\n * Modify default styling of address.\n */\naddress {\n  font-style: normal; }\n\n/**\n * 1. Remove the bottom border in Firefox 39-.\n * 2. Add the correct text decoration in Chrome, Edge, IE, Opera, and Safari. (removed)\n */\n/**\n * Prevent the duplicate application of `bolder` by the next rule in Safari 6.\n */\nb,\nstrong {\n  font-weight: inherit; }\n\n/**\n * Add the correct font weight in Chrome, Edge, and Safari.\n */\nb,\nstrong {\n  font-weight: bolder; }\n\n/**\n * 1. Correct the inheritance and scaling of font size in all browsers.\n * 2. Correct the odd `em` font sizing in all browsers.\n */\ncode,\nkbd,\npre,\nsamp {\n  font-family: \"SF Mono\", \"Segoe UI Mono\", \"Roboto Mono\", Menlo, Courier, monospace;\n  /* 1 (changed) */\n  font-size: 1em;\n  /* 2 */ }\n\n/**\n * Add the correct font style in Android 4.3-.\n */\ndfn {\n  font-style: italic; }\n\n/**\n * Add the correct background and color in IE 9-. (Removed)\n */\n/**\n * Add the correct font size in all browsers.\n */\nsmall {\n  font-size: 80%;\n  font-weight: 400;\n  /* (added) */ }\n\n/**\n * Prevent `sub` and `sup` elements from affecting the line height in\n * all browsers.\n */\nsub,\nsup {\n  font-size: 75%;\n  line-height: 0;\n  position: relative;\n  vertical-align: baseline; }\n\nsub {\n  bottom: -0.25em; }\n\nsup {\n  top: -0.5em; }\n\n/* Embedded content\n   ========================================================================== */\n/**\n * Add the correct display in IE 9-.\n */\naudio,\nvideo {\n  display: inline-block; }\n\n/**\n * Add the correct display in iOS 4-7.\n */\naudio:not([controls]) {\n  display: none;\n  height: 0; }\n\n/**\n * Remove the border on images inside links in IE 10-.\n */\nimg {\n  border-style: none; }\n\n/**\n * Hide the overflow in IE.\n */\nsvg:not(:root) {\n  overflow: hidden; }\n\n/* Forms\n   ========================================================================== */\n/**\n * 1. Change the font styles in all browsers (opinionated).\n * 2. Remove the margin in Firefox and Safari.\n */\nbutton,\ninput,\noptgroup,\nselect,\ntextarea {\n  font-family: inherit;\n  /* 1 (changed) */\n  font-size: inherit;\n  /* 1 (changed) */\n  line-height: inherit;\n  /* 1 (changed) */\n  margin: 0;\n  /* 2 */ }\n\n/**\n * Show the overflow in IE.\n * 1. Show the overflow in Edge.\n */\nbutton,\ninput {\n  /* 1 */\n  overflow: visible; }\n\n/**\n * Remove the inheritance of text transform in Edge, Firefox, and IE.\n * 1. Remove the inheritance of text transform in Firefox.\n */\nbutton,\nselect {\n  /* 1 */\n  text-transform: none; }\n\n/**\n * 1. Prevent a WebKit bug where (2) destroys native `audio` and `video`\n *    controls in Android 4.\n * 2. Correct the inability to style clickable types in iOS and Safari.\n */\nbutton,\nhtml [type=\"button\"],\n[type=\"reset\"],\n[type=\"submit\"] {\n  -webkit-appearance: button;\n  /* 2 */ }\n\n/**\n * Remove the inner border and padding in Firefox.\n */\nbutton::-moz-focus-inner,\n[type=\"button\"]::-moz-focus-inner,\n[type=\"reset\"]::-moz-focus-inner,\n[type=\"submit\"]::-moz-focus-inner {\n  border-style: none;\n  padding: 0; }\n\n/**\n * Restore the focus styles unset by the previous rule (removed).\n */\n/**\n * Change the border, margin, and padding in all browsers (opinionated) (changed).\n */\nfieldset {\n  border: 0;\n  margin: 0;\n  padding: 0; }\n\n/**\n * 1. Correct the text wrapping in Edge and IE.\n * 2. Correct the color inheritance from `fieldset` elements in IE.\n * 3. Remove the padding so developers are not caught out when they zero out\n *    `fieldset` elements in all browsers.\n */\nlegend {\n  box-sizing: border-box;\n  /* 1 */\n  color: inherit;\n  /* 2 */\n  display: table;\n  /* 1 */\n  max-width: 100%;\n  /* 1 */\n  padding: 0;\n  /* 3 */\n  white-space: normal;\n  /* 1 */ }\n\n/**\n * 1. Add the correct display in IE 9-.\n * 2. Add the correct vertical alignment in Chrome, Firefox, and Opera.\n */\nprogress {\n  display: inline-block;\n  /* 1 */\n  vertical-align: baseline;\n  /* 2 */ }\n\n/**\n * Remove the default vertical scrollbar in IE.\n */\ntextarea {\n  overflow: auto; }\n\n/**\n * 1. Add the correct box sizing in IE 10-.\n * 2. Remove the padding in IE 10-.\n */\n[type=\"checkbox\"],\n[type=\"radio\"] {\n  box-sizing: border-box;\n  /* 1 */\n  padding: 0;\n  /* 2 */ }\n\n/**\n * Correct the cursor style of increment and decrement buttons in Chrome.\n */\n[type=\"number\"]::-webkit-inner-spin-button,\n[type=\"number\"]::-webkit-outer-spin-button {\n  height: auto; }\n\n/**\n * 1. Correct the odd appearance in Chrome and Safari.\n * 2. Correct the outline style in Safari.\n */\n[type=\"search\"] {\n  -webkit-appearance: textfield;\n  /* 1 */\n  outline-offset: -2px;\n  /* 2 */ }\n\n/**\n * Remove the inner padding and cancel buttons in Chrome and Safari on macOS.\n */\n[type=\"search\"]::-webkit-search-cancel-button,\n[type=\"search\"]::-webkit-search-decoration {\n  -webkit-appearance: none; }\n\n/**\n * 1. Correct the inability to style clickable types in iOS and Safari.\n * 2. Change font properties to `inherit` in Safari.\n */\n::-webkit-file-upload-button {\n  -webkit-appearance: button;\n  /* 1 */\n  font: inherit;\n  /* 2 */ }\n\n/* Interactive\n   ========================================================================== */\n/*\n * Add the correct display in IE 9-.\n * 1. Add the correct display in Edge, IE, and Firefox.\n */\ndetails,\nmenu {\n  display: block; }\n\n/*\n * Add the correct display in all browsers.\n */\nsummary {\n  display: list-item;\n  outline: none; }\n\n/* Scripting\n   ========================================================================== */\n/**\n * Add the correct display in IE 9-.\n */\ncanvas {\n  display: inline-block; }\n\n/**\n * Add the correct display in IE.\n */\ntemplate {\n  display: none; }\n\n/* Hidden\n   ========================================================================== */\n/**\n * Add the correct display in IE 10-.\n */\n[hidden] {\n  display: none; }\n\n*,\n*::before,\n*::after {\n  box-sizing: inherit; }\n\nhtml {\n  box-sizing: border-box;\n  font-size: 20px;\n  line-height: 1.5;\n  -webkit-tap-highlight-color: transparent; }\n\nbody {\n  background: #fff;\n  color: #50596c;\n  font-family: -apple-system, system-ui, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif;\n  font-size: 0.8rem;\n  overflow-x: hidden;\n  text-rendering: optimizeLegibility; }\n\na {\n  color: #5755d9;\n  outline: none;\n  text-decoration: none; }\n  a:focus {\n    box-shadow: 0 0 0 0.1rem rgba(87, 85, 217, 0.2); }\n  a:focus, a:hover, a:active, a.active {\n    color: #4240d4;\n    text-decoration: underline; }\n\nh1,\nh2,\nh3,\nh4,\nh5,\nh6 {\n  color: inherit;\n  font-weight: 500;\n  line-height: 1.2;\n  margin-bottom: .5em;\n  margin-top: 0; }\n\n.h1,\n.h2,\n.h3,\n.h4,\n.h5,\n.h6 {\n  font-weight: 500; }\n\nh1,\n.h1 {\n  font-size: 2rem; }\n\nh2,\n.h2 {\n  font-size: 1.6rem; }\n\nh3,\n.h3 {\n  font-size: 1.4rem; }\n\nh4,\n.h4 {\n  font-size: 1.2rem; }\n\nh5,\n.h5 {\n  font-size: 1rem; }\n\nh6,\n.h6 {\n  font-size: .8rem; }\n\np {\n  margin: 0 0 1rem; }\n\na,\nins,\nu {\n  text-decoration-skip: ink edges; }\n\nabbr[title] {\n  border-bottom: 0.05rem dotted;\n  cursor: help;\n  text-decoration: none; }\n\nkbd {\n  border-radius: 0.1rem;\n  line-height: 1.2;\n  padding: .1rem .15rem;\n  background: #454d5d;\n  color: #fff;\n  font-size: 0.7rem; }\n\nmark {\n  background: #ffe9b3;\n  color: #50596c;\n  border-radius: 0.1rem;\n  padding: .05rem; }\n\nblockquote {\n  border-left: 0.1rem solid #e7e9ed;\n  margin-left: 0;\n  padding: 0.4rem 0.8rem; }\n  blockquote p:last-child {\n    margin-bottom: 0; }\n\nul,\nol {\n  margin: 0.8rem 0 0.8rem 0.8rem;\n  padding: 0; }\n  ul ul,\n  ul ol,\n  ol ul,\n  ol ol {\n    margin: 0.8rem 0 0.8rem 0.8rem; }\n  ul li,\n  ol li {\n    margin-top: 0.4rem; }\n\nul {\n  list-style: disc inside; }\n  ul ul {\n    list-style-type: circle; }\n\nol {\n  list-style: decimal inside; }\n  ol ol {\n    list-style-type: lower-alpha; }\n\ndl dt {\n  font-weight: bold; }\n\ndl dd {\n  margin: 0.4rem 0 0.8rem 0; }\n\n:lang(zh) {\n  font-family: -apple-system, system-ui, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", \"Helvetica Neue\", sans-serif; }\n\n:lang(ja) {\n  font-family: -apple-system, system-ui, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Hiragino Sans\", \"Hiragino Kaku Gothic Pro\", \"Yu Gothic\", YuGothic, Meiryo, \"Helvetica Neue\", sans-serif; }\n\n:lang(ko) {\n  font-family: -apple-system, system-ui, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Malgun Gothic\", \"Helvetica Neue\", sans-serif; }\n\n:lang(zh) ins,\n:lang(zh) u,\n:lang(ja) ins,\n:lang(ja) u,\n.cjk ins,\n.cjk u {\n  border-bottom: 0.05rem solid;\n  text-decoration: none; }\n\n:lang(zh) del + del,\n:lang(zh) del + s,\n:lang(zh) ins + ins,\n:lang(zh) ins + u,\n:lang(zh) s + del,\n:lang(zh) s + s,\n:lang(zh) u + ins,\n:lang(zh) u + u,\n:lang(ja) del + del,\n:lang(ja) del + s,\n:lang(ja) ins + ins,\n:lang(ja) ins + u,\n:lang(ja) s + del,\n:lang(ja) s + s,\n:lang(ja) u + ins,\n:lang(ja) u + u,\n.cjk del + del,\n.cjk del + s,\n.cjk ins + ins,\n.cjk ins + u,\n.cjk s + del,\n.cjk s + s,\n.cjk u + ins,\n.cjk u + u {\n  margin-left: .125em; }\n\n.table {\n  border-collapse: collapse;\n  border-spacing: 0;\n  width: 100%;\n  text-align: left; }\n  .table.table-striped tbody tr:nth-of-type(odd) {\n    background: #f8f9fa; }\n  .table tbody tr.active, .table.table-striped tbody tr.active {\n    background: #f0f1f4; }\n  .table.table-hover tbody tr:hover {\n    background: #f0f1f4; }\n  .table.table-scroll {\n    display: block;\n    overflow-x: auto;\n    padding-bottom: .75rem;\n    white-space: nowrap; }\n  .table td,\n  .table th {\n    border-bottom: 0.05rem solid #e7e9ed;\n    padding: 0.6rem 0.4rem; }\n  .table th {\n    border-bottom-width: 0.1rem; }\n\n.btn {\n  transition: all .2s ease;\n  appearance: none;\n  background: #fff;\n  border: 0.05rem solid #5755d9;\n  border-radius: 0.1rem;\n  color: #5755d9;\n  cursor: pointer;\n  display: inline-block;\n  font-size: 0.8rem;\n  height: 1.8rem;\n  line-height: 1rem;\n  outline: none;\n  padding: 0.35rem 0.4rem;\n  text-align: center;\n  text-decoration: none;\n  user-select: none;\n  vertical-align: middle;\n  white-space: nowrap; }\n  .btn:focus {\n    box-shadow: 0 0 0 0.1rem rgba(87, 85, 217, 0.2); }\n  .btn:focus, .btn:hover {\n    background: #f1f1fc;\n    border-color: #4b48d6;\n    text-decoration: none; }\n  .btn:active, .btn.active {\n    background: #4b48d6;\n    border-color: #3634d2;\n    color: #fff;\n    text-decoration: none; }\n    .btn:active.loading::after, .btn.active.loading::after {\n      border-bottom-color: #fff;\n      border-left-color: #fff; }\n  .btn[disabled], .btn:disabled, .btn.disabled {\n    cursor: default;\n    opacity: .5;\n    pointer-events: none; }\n  .btn.btn-primary {\n    background: #5755d9;\n    border-color: #4b48d6;\n    color: #fff; }\n    .btn.btn-primary:focus, .btn.btn-primary:hover {\n      background: #4240d4;\n      border-color: #3634d2;\n      color: #fff; }\n    .btn.btn-primary:active, .btn.btn-primary.active {\n      background: #3a38d2;\n      border-color: #302ecd;\n      color: #fff; }\n    .btn.btn-primary.loading::after {\n      border-bottom-color: #fff;\n      border-left-color: #fff; }\n  .btn.btn-success {\n    background: #32b643;\n    border-color: #2faa3f;\n    color: #fff; }\n    .btn.btn-success:focus {\n      box-shadow: 0 0 0 0.1rem rgba(50, 182, 67, 0.2); }\n    .btn.btn-success:focus, .btn.btn-success:hover {\n      background: #30ae40;\n      border-color: #2da23c;\n      color: #fff; }\n    .btn.btn-success:active, .btn.btn-success.active {\n      background: #2a9a39;\n      border-color: #278e34;\n      color: #fff; }\n    .btn.btn-success.loading::after {\n      border-bottom-color: #fff;\n      border-left-color: #fff; }\n  .btn.btn-error {\n    background: #e85600;\n    border-color: #d95000;\n    color: #fff; }\n    .btn.btn-error:focus {\n      box-shadow: 0 0 0 0.1rem rgba(232, 86, 0, 0.2); }\n    .btn.btn-error:focus, .btn.btn-error:hover {\n      background: #de5200;\n      border-color: #cf4d00;\n      color: #fff; }\n    .btn.btn-error:active, .btn.btn-error.active {\n      background: #c44900;\n      border-color: #b54300;\n      color: #fff; }\n    .btn.btn-error.loading::after {\n      border-bottom-color: #fff;\n      border-left-color: #fff; }\n  .btn.btn-link {\n    background: transparent;\n    border-color: transparent;\n    color: #5755d9; }\n    .btn.btn-link:focus, .btn.btn-link:hover, .btn.btn-link:active, .btn.btn-link.active {\n      color: #4240d4; }\n  .btn.btn-sm {\n    font-size: 0.7rem;\n    height: 1.4rem;\n    padding: 0.15rem 0.3rem; }\n  .btn.btn-lg {\n    font-size: 0.9rem;\n    height: 2rem;\n    padding: 0.45rem 0.6rem; }\n  .btn.btn-block {\n    display: block;\n    width: 100%; }\n  .btn.btn-action {\n    width: 1.8rem;\n    padding-left: 0;\n    padding-right: 0; }\n    .btn.btn-action.btn-sm {\n      width: 1.4rem; }\n    .btn.btn-action.btn-lg {\n      width: 2rem; }\n  .btn.btn-clear {\n    background: transparent;\n    border: 0;\n    color: currentColor;\n    height: 0.8rem;\n    line-height: 0.8rem;\n    margin-left: 0.2rem;\n    margin-right: -2px;\n    opacity: 1;\n    padding: 0;\n    text-decoration: none;\n    width: 0.8rem; }\n    .btn.btn-clear:hover {\n      opacity: .95; }\n    .btn.btn-clear::before {\n      content: \"\\2715\"; }\n\n.btn-group {\n  display: inline-flex;\n  flex-wrap: wrap; }\n  .btn-group .btn {\n    flex: 1 0 auto; }\n    .btn-group .btn:first-child:not(:last-child) {\n      border-bottom-right-radius: 0;\n      border-top-right-radius: 0; }\n    .btn-group .btn:not(:first-child):not(:last-child) {\n      border-radius: 0;\n      margin-left: -0.05rem; }\n    .btn-group .btn:last-child:not(:first-child) {\n      border-bottom-left-radius: 0;\n      border-top-left-radius: 0;\n      margin-left: -0.05rem; }\n    .btn-group .btn:focus, .btn-group .btn:hover, .btn-group .btn:active, .btn-group .btn.active {\n      z-index: 1; }\n  .btn-group.btn-group-block {\n    display: flex; }\n    .btn-group.btn-group-block .btn {\n      flex: 1 0 0; }\n\n.form-group:not(:last-child) {\n  margin-bottom: 0.4rem; }\n\nfieldset {\n  margin-bottom: 0.8rem; }\n\nlegend {\n  font-size: 0.9rem;\n  font-weight: 500;\n  margin-bottom: 0.8rem; }\n\n.form-label {\n  display: block;\n  line-height: 1rem;\n  padding: 0.4rem 0; }\n  .form-label.label-sm {\n    font-size: 0.7rem;\n    padding: 0.2rem 0; }\n  .form-label.label-lg {\n    font-size: 0.9rem;\n    padding: 0.5rem 0; }\n\n.form-input {\n  transition: all .2s ease;\n  appearance: none;\n  background: #fff;\n  background-image: none;\n  border: 0.05rem solid #caced7;\n  border-radius: 0.1rem;\n  color: #50596c;\n  display: block;\n  font-size: 0.8rem;\n  height: 1.8rem;\n  line-height: 1rem;\n  max-width: 100%;\n  outline: none;\n  padding: 0.35rem 0.4rem;\n  position: relative;\n  width: 100%; }\n  .form-input:focus {\n    box-shadow: 0 0 0 0.1rem rgba(87, 85, 217, 0.2);\n    border-color: #5755d9; }\n  .form-input::placeholder {\n    color: #acb3c2; }\n  .form-input.input-sm {\n    font-size: 0.7rem;\n    height: 1.4rem;\n    padding: 0.15rem 0.3rem; }\n  .form-input.input-lg {\n    font-size: 0.9rem;\n    height: 2rem;\n    padding: 0.45rem 0.6rem; }\n  .form-input.input-inline {\n    display: inline-block;\n    vertical-align: middle;\n    width: auto; }\n  .form-input[type=\"file\"] {\n    height: auto; }\n\ntextarea.form-input {\n  height: auto; }\n\n.form-input-hint {\n  color: #acb3c2;\n  font-size: 0.7rem;\n  margin-top: 0.2rem; }\n  .has-success .form-input-hint,\n  .is-success + .form-input-hint {\n    color: #32b643; }\n  .has-error .form-input-hint,\n  .is-error + .form-input-hint {\n    color: #e85600; }\n\n.form-select {\n  appearance: none;\n  border: 0.05rem solid #caced7;\n  border-radius: 0.1rem;\n  color: inherit;\n  font-size: 0.8rem;\n  height: 1.8rem;\n  line-height: 1rem;\n  outline: none;\n  padding: 0.35rem 0.4rem;\n  vertical-align: middle;\n  width: 100%; }\n  .form-select[size], .form-select[multiple] {\n    height: auto; }\n    .form-select[size] option, .form-select[multiple] option {\n      padding: 0.1rem 0.2rem; }\n  .form-select:not([multiple]):not([size]) {\n    background: #fff url(\"data:image/svg+xml;charset=utf8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%204%205'%3E%3Cpath%20fill='%23667189'%20d='M2%200L0%202h4zm0%205L0%203h4z'/%3E%3C/svg%3E\") no-repeat right 0.35rem center/0.4rem 0.5rem;\n    padding-right: 1.2rem; }\n  .form-select:focus {\n    box-shadow: 0 0 0 0.1rem rgba(87, 85, 217, 0.2);\n    border-color: #5755d9; }\n  .form-select::-ms-expand {\n    display: none; }\n  .form-select.select-sm {\n    font-size: 0.7rem;\n    height: 1.4rem;\n    padding: 0.15rem 1.1rem 0.15rem 0.3rem; }\n  .form-select.select-lg {\n    font-size: 0.9rem;\n    height: 2rem;\n    padding: 0.45rem 1.4rem 0.45rem 0.6rem; }\n\n.has-icon-left,\n.has-icon-right {\n  position: relative; }\n  .has-icon-left .form-icon,\n  .has-icon-right .form-icon {\n    height: 0.8rem;\n    margin: 0 0.35rem;\n    position: absolute;\n    top: 50%;\n    transform: translateY(-50%);\n    width: 0.8rem;\n    z-index: 2; }\n\n.has-icon-left .form-icon {\n  left: 0.05rem; }\n\n.has-icon-left .form-input {\n  padding-left: 1.5rem; }\n\n.has-icon-right .form-icon {\n  right: 0.05rem; }\n\n.has-icon-right .form-input {\n  padding-right: 1.5rem; }\n\n.form-checkbox,\n.form-radio,\n.form-switch {\n  display: inline-block;\n  line-height: 1rem;\n  margin: 0.2rem 0;\n  min-height: 1.2rem;\n  padding: 0.2rem 0.4rem 0.2rem 1.2rem;\n  position: relative; }\n  .form-checkbox input,\n  .form-radio input,\n  .form-switch input {\n    clip: rect(0, 0, 0, 0);\n    height: 1px;\n    margin: -1px;\n    overflow: hidden;\n    position: absolute;\n    width: 1px; }\n    .form-checkbox input:focus + .form-icon,\n    .form-radio input:focus + .form-icon,\n    .form-switch input:focus + .form-icon {\n      box-shadow: 0 0 0 0.1rem rgba(87, 85, 217, 0.2);\n      border-color: #5755d9; }\n    .form-checkbox input:checked + .form-icon,\n    .form-radio input:checked + .form-icon,\n    .form-switch input:checked + .form-icon {\n      background: #5755d9;\n      border-color: #5755d9; }\n  .form-checkbox .form-icon,\n  .form-radio .form-icon,\n  .form-switch .form-icon {\n    transition: all .2s ease;\n    border: 0.05rem solid #caced7;\n    cursor: pointer;\n    display: inline-block;\n    position: absolute; }\n  .form-checkbox.input-sm,\n  .form-radio.input-sm,\n  .form-switch.input-sm {\n    font-size: 0.7rem;\n    margin: 0; }\n  .form-checkbox.input-lg,\n  .form-radio.input-lg,\n  .form-switch.input-lg {\n    font-size: 0.9rem;\n    margin: 0.3rem 0; }\n\n.form-checkbox .form-icon,\n.form-radio .form-icon {\n  background: #fff;\n  height: 0.8rem;\n  left: 0;\n  top: 0.3rem;\n  width: 0.8rem; }\n\n.form-checkbox input:active + .form-icon,\n.form-radio input:active + .form-icon {\n  background: #f0f1f4; }\n\n.form-checkbox .form-icon {\n  border-radius: 0.1rem; }\n\n.form-checkbox input:checked + .form-icon::before {\n  background-clip: padding-box;\n  border: 0.1rem solid #fff;\n  border-left-width: 0;\n  border-top-width: 0;\n  content: \"\";\n  height: 12px;\n  left: 50%;\n  margin-left: -4px;\n  margin-top: -8px;\n  position: absolute;\n  top: 50%;\n  transform: rotate(45deg);\n  width: 8px; }\n\n.form-checkbox input:indeterminate + .form-icon {\n  background: #5755d9;\n  border-color: #5755d9; }\n  .form-checkbox input:indeterminate + .form-icon::before {\n    background: #fff;\n    content: \"\";\n    height: 2px;\n    left: 50%;\n    margin-left: -5px;\n    margin-top: -1px;\n    position: absolute;\n    top: 50%;\n    width: 10px; }\n\n.form-radio .form-icon {\n  border-radius: 50%; }\n\n.form-radio input:checked + .form-icon::before {\n  background: #fff;\n  border-radius: 50%;\n  content: \"\";\n  height: 4px;\n  left: 50%;\n  position: absolute;\n  top: 50%;\n  transform: translate(-50%, -50%);\n  width: 4px; }\n\n.form-switch {\n  padding-left: 2rem; }\n  .form-switch .form-icon {\n    background: #e7e9ed;\n    background-clip: padding-box;\n    border-radius: 0.45rem;\n    height: 0.9rem;\n    left: 0;\n    top: 0.25rem;\n    width: 1.6rem; }\n    .form-switch .form-icon::before {\n      transition: all .2s ease;\n      background: #fff;\n      border-radius: 50%;\n      content: \"\";\n      display: block;\n      height: 0.8rem;\n      left: 0;\n      position: absolute;\n      top: 0;\n      width: 0.8rem; }\n  .form-switch input:checked + .form-icon::before {\n    left: 14px; }\n  .form-switch input:active + .form-icon::before {\n    background: #f8f9fa; }\n\n.input-group {\n  display: flex; }\n  .input-group .input-group-addon {\n    background: #f8f9fa;\n    border: 0.05rem solid #caced7;\n    border-radius: 0.1rem;\n    line-height: 1rem;\n    padding: 0.35rem 0.4rem;\n    white-space: nowrap; }\n    .input-group .input-group-addon.addon-sm {\n      font-size: 0.7rem;\n      padding: 0.15rem 0.3rem; }\n    .input-group .input-group-addon.addon-lg {\n      font-size: 0.9rem;\n      padding: 0.45rem 0.6rem; }\n  .input-group .form-input,\n  .input-group .form-select {\n    flex: 1 1 auto; }\n  .input-group .input-group-btn {\n    z-index: 1; }\n  .input-group .form-input:first-child:not(:last-child),\n  .input-group .form-select:first-child:not(:last-child),\n  .input-group .input-group-addon:first-child:not(:last-child),\n  .input-group .input-group-btn:first-child:not(:last-child) {\n    border-bottom-right-radius: 0;\n    border-top-right-radius: 0; }\n  .input-group .form-input:not(:first-child):not(:last-child),\n  .input-group .form-select:not(:first-child):not(:last-child),\n  .input-group .input-group-addon:not(:first-child):not(:last-child),\n  .input-group .input-group-btn:not(:first-child):not(:last-child) {\n    border-radius: 0;\n    margin-left: -0.05rem; }\n  .input-group .form-input:last-child:not(:first-child),\n  .input-group .form-select:last-child:not(:first-child),\n  .input-group .input-group-addon:last-child:not(:first-child),\n  .input-group .input-group-btn:last-child:not(:first-child) {\n    border-bottom-left-radius: 0;\n    border-top-left-radius: 0;\n    margin-left: -0.05rem; }\n  .input-group .form-input:focus,\n  .input-group .form-select:focus,\n  .input-group .input-group-addon:focus,\n  .input-group .input-group-btn:focus {\n    z-index: 2; }\n  .input-group .form-select {\n    width: auto; }\n  .input-group.input-inline {\n    display: inline-flex; }\n\n.has-success .form-input, .form-input.is-success, .has-success\n.form-select,\n.form-select.is-success {\n  border-color: #32b643; }\n  .has-success .form-input:focus, .form-input.is-success:focus, .has-success\n  .form-select:focus,\n  .form-select.is-success:focus {\n    box-shadow: 0 0 0 0.1rem rgba(50, 182, 67, 0.2); }\n\n.has-error .form-input, .form-input.is-error, .has-error\n.form-select,\n.form-select.is-error {\n  border-color: #e85600; }\n  .has-error .form-input:focus, .form-input.is-error:focus, .has-error\n  .form-select:focus,\n  .form-select.is-error:focus {\n    box-shadow: 0 0 0 0.1rem rgba(232, 86, 0, 0.2); }\n\n.has-error .form-checkbox .form-icon, .form-checkbox.is-error .form-icon, .has-error\n.form-radio .form-icon,\n.form-radio.is-error .form-icon, .has-error\n.form-switch .form-icon,\n.form-switch.is-error .form-icon {\n  border-color: #e85600; }\n\n.has-error .form-checkbox input:checked + .form-icon, .form-checkbox.is-error input:checked + .form-icon, .has-error\n.form-radio input:checked + .form-icon,\n.form-radio.is-error input:checked + .form-icon, .has-error\n.form-switch input:checked + .form-icon,\n.form-switch.is-error input:checked + .form-icon {\n  background: #e85600;\n  border-color: #e85600; }\n\n.has-error .form-checkbox input:focus + .form-icon, .form-checkbox.is-error input:focus + .form-icon, .has-error\n.form-radio input:focus + .form-icon,\n.form-radio.is-error input:focus + .form-icon, .has-error\n.form-switch input:focus + .form-icon,\n.form-switch.is-error input:focus + .form-icon {\n  box-shadow: 0 0 0 0.1rem rgba(232, 86, 0, 0.2);\n  border-color: #e85600; }\n\n.form-input:not(:placeholder-shown):invalid {\n  border-color: #e85600; }\n  .form-input:not(:placeholder-shown):invalid:focus {\n    box-shadow: 0 0 0 0.1rem rgba(232, 86, 0, 0.2); }\n  .form-input:not(:placeholder-shown):invalid + .form-input-hint {\n    color: #e85600; }\n\n.form-input:disabled, .form-input.disabled,\n.form-select:disabled,\n.form-select.disabled {\n  background-color: #f0f1f4;\n  cursor: not-allowed;\n  opacity: .5; }\n\n.form-input[readonly] {\n  background-color: #f8f9fa; }\n\ninput:disabled + .form-icon, input.disabled + .form-icon {\n  background: #f0f1f4;\n  cursor: not-allowed;\n  opacity: .5; }\n\n.form-switch input:disabled + .form-icon::before, .form-switch input.disabled + .form-icon::before {\n  background: #fff; }\n\n.form-horizontal {\n  padding: 0.4rem 0; }\n  .form-horizontal .form-group {\n    display: flex;\n    flex-wrap: wrap; }\n\n.label {\n  border-radius: 0.1rem;\n  line-height: 1.2;\n  padding: .1rem .15rem;\n  background: #f0f1f4;\n  color: #5b657a;\n  display: inline-block; }\n  .label.label-rounded {\n    border-radius: 5rem;\n    padding-left: .4rem;\n    padding-right: .4rem; }\n  .label.label-primary {\n    background: #5755d9;\n    color: #fff; }\n  .label.label-secondary {\n    background: #f1f1fc;\n    color: #5755d9; }\n  .label.label-success {\n    background: #32b643;\n    color: #fff; }\n  .label.label-warning {\n    background: #ffb700;\n    color: #fff; }\n  .label.label-error {\n    background: #e85600;\n    color: #fff; }\n\ncode {\n  border-radius: 0.1rem;\n  line-height: 1.2;\n  padding: .1rem .15rem;\n  background: #fdf4f4;\n  color: #e06870;\n  font-size: 85%; }\n\n.code {\n  border-radius: 0.1rem;\n  color: #50596c;\n  position: relative; }\n  .code::before {\n    color: #acb3c2;\n    content: attr(data-lang);\n    font-size: 0.7rem;\n    position: absolute;\n    right: 0.4rem;\n    top: 0.1rem; }\n  .code code {\n    background: #f8f9fa;\n    color: inherit;\n    display: block;\n    line-height: 1.5;\n    overflow-x: auto;\n    padding: 1rem;\n    width: 100%; }\n\n.img-responsive {\n  display: block;\n  height: auto;\n  max-width: 100%; }\n\n.img-fit-cover {\n  object-fit: cover; }\n\n.img-fit-contain {\n  object-fit: contain; }\n\n.video-responsive {\n  display: block;\n  overflow: hidden;\n  padding: 0;\n  position: relative;\n  width: 100%; }\n  .video-responsive::before {\n    content: \"\";\n    display: block;\n    padding-bottom: 56.25%; }\n  .video-responsive iframe,\n  .video-responsive object,\n  .video-responsive embed {\n    border: 0;\n    bottom: 0;\n    height: 100%;\n    left: 0;\n    position: absolute;\n    right: 0;\n    top: 0;\n    width: 100%; }\n\nvideo.video-responsive {\n  height: auto;\n  max-width: 100%; }\n  video.video-responsive::before {\n    content: none; }\n\n.video-responsive-4-3::before {\n  padding-bottom: 75%; }\n\n.video-responsive-1-1::before {\n  padding-bottom: 100%; }\n\n.figure {\n  margin: 0 0 0.4rem 0; }\n  .figure .figure-caption {\n    color: #667189;\n    margin-top: 0.4rem; }\n\n.container {\n  margin-left: auto;\n  margin-right: auto;\n  padding-left: 0.4rem;\n  padding-right: 0.4rem;\n  width: 100%; }\n  .container.grid-xl {\n    max-width: 1296px; }\n  .container.grid-lg {\n    max-width: 976px; }\n  .container.grid-md {\n    max-width: 856px; }\n  .container.grid-sm {\n    max-width: 616px; }\n  .container.grid-xs {\n    max-width: 496px; }\n\n.show-xs,\n.show-sm,\n.show-md,\n.show-lg,\n.show-xl {\n  display: none !important; }\n\n.columns {\n  display: flex;\n  flex-wrap: wrap;\n  margin-left: -0.4rem;\n  margin-right: -0.4rem; }\n  .columns.col-gapless {\n    margin-left: 0;\n    margin-right: 0; }\n    .columns.col-gapless > .column {\n      padding-left: 0;\n      padding-right: 0; }\n  .columns.col-oneline {\n    flex-wrap: nowrap;\n    overflow-x: auto; }\n\n.column {\n  flex: 1;\n  max-width: 100%;\n  padding-left: 0.4rem;\n  padding-right: 0.4rem; }\n  .column.col-12, .column.col-11, .column.col-10, .column.col-9, .column.col-8, .column.col-7, .column.col-6, .column.col-5, .column.col-4, .column.col-3, .column.col-2, .column.col-1 {\n    flex: none; }\n\n.col-12 {\n  width: 100%; }\n\n.col-11 {\n  width: 91.66666667%; }\n\n.col-10 {\n  width: 83.33333333%; }\n\n.col-9 {\n  width: 75%; }\n\n.col-8 {\n  width: 66.66666667%; }\n\n.col-7 {\n  width: 58.33333333%; }\n\n.col-6 {\n  width: 50%; }\n\n.col-5 {\n  width: 41.66666667%; }\n\n.col-4 {\n  width: 33.33333333%; }\n\n.col-3 {\n  width: 25%; }\n\n.col-2 {\n  width: 16.66666667%; }\n\n.col-1 {\n  width: 8.33333333%; }\n\n.col-auto {\n  flex: 0 0 auto;\n  max-width: none;\n  width: auto; }\n\n.col-mx-auto {\n  margin-left: auto;\n  margin-right: auto; }\n\n.col-ml-auto {\n  margin-left: auto; }\n\n.col-mr-auto {\n  margin-right: auto; }\n\n@media (max-width: 1280px) {\n  .col-xl-12,\n  .col-xl-11,\n  .col-xl-10,\n  .col-xl-9,\n  .col-xl-8,\n  .col-xl-7,\n  .col-xl-6,\n  .col-xl-5,\n  .col-xl-4,\n  .col-xl-3,\n  .col-xl-2,\n  .col-xl-1 {\n    flex: none; }\n  .col-xl-12 {\n    width: 100%; }\n  .col-xl-11 {\n    width: 91.66666667%; }\n  .col-xl-10 {\n    width: 83.33333333%; }\n  .col-xl-9 {\n    width: 75%; }\n  .col-xl-8 {\n    width: 66.66666667%; }\n  .col-xl-7 {\n    width: 58.33333333%; }\n  .col-xl-6 {\n    width: 50%; }\n  .col-xl-5 {\n    width: 41.66666667%; }\n  .col-xl-4 {\n    width: 33.33333333%; }\n  .col-xl-3 {\n    width: 25%; }\n  .col-xl-2 {\n    width: 16.66666667%; }\n  .col-xl-1 {\n    width: 8.33333333%; }\n  .hide-xl {\n    display: none !important; }\n  .show-xl {\n    display: block !important; } }\n\n@media (max-width: 960px) {\n  .col-lg-12,\n  .col-lg-11,\n  .col-lg-10,\n  .col-lg-9,\n  .col-lg-8,\n  .col-lg-7,\n  .col-lg-6,\n  .col-lg-5,\n  .col-lg-4,\n  .col-lg-3,\n  .col-lg-2,\n  .col-lg-1 {\n    flex: none; }\n  .col-lg-12 {\n    width: 100%; }\n  .col-lg-11 {\n    width: 91.66666667%; }\n  .col-lg-10 {\n    width: 83.33333333%; }\n  .col-lg-9 {\n    width: 75%; }\n  .col-lg-8 {\n    width: 66.66666667%; }\n  .col-lg-7 {\n    width: 58.33333333%; }\n  .col-lg-6 {\n    width: 50%; }\n  .col-lg-5 {\n    width: 41.66666667%; }\n  .col-lg-4 {\n    width: 33.33333333%; }\n  .col-lg-3 {\n    width: 25%; }\n  .col-lg-2 {\n    width: 16.66666667%; }\n  .col-lg-1 {\n    width: 8.33333333%; }\n  .hide-lg {\n    display: none !important; }\n  .show-lg {\n    display: block !important; } }\n\n@media (max-width: 840px) {\n  .col-md-12,\n  .col-md-11,\n  .col-md-10,\n  .col-md-9,\n  .col-md-8,\n  .col-md-7,\n  .col-md-6,\n  .col-md-5,\n  .col-md-4,\n  .col-md-3,\n  .col-md-2,\n  .col-md-1 {\n    flex: none; }\n  .col-md-12 {\n    width: 100%; }\n  .col-md-11 {\n    width: 91.66666667%; }\n  .col-md-10 {\n    width: 83.33333333%; }\n  .col-md-9 {\n    width: 75%; }\n  .col-md-8 {\n    width: 66.66666667%; }\n  .col-md-7 {\n    width: 58.33333333%; }\n  .col-md-6 {\n    width: 50%; }\n  .col-md-5 {\n    width: 41.66666667%; }\n  .col-md-4 {\n    width: 33.33333333%; }\n  .col-md-3 {\n    width: 25%; }\n  .col-md-2 {\n    width: 16.66666667%; }\n  .col-md-1 {\n    width: 8.33333333%; }\n  .hide-md {\n    display: none !important; }\n  .show-md {\n    display: block !important; } }\n\n@media (max-width: 600px) {\n  .col-sm-12,\n  .col-sm-11,\n  .col-sm-10,\n  .col-sm-9,\n  .col-sm-8,\n  .col-sm-7,\n  .col-sm-6,\n  .col-sm-5,\n  .col-sm-4,\n  .col-sm-3,\n  .col-sm-2,\n  .col-sm-1 {\n    flex: none; }\n  .col-sm-12 {\n    width: 100%; }\n  .col-sm-11 {\n    width: 91.66666667%; }\n  .col-sm-10 {\n    width: 83.33333333%; }\n  .col-sm-9 {\n    width: 75%; }\n  .col-sm-8 {\n    width: 66.66666667%; }\n  .col-sm-7 {\n    width: 58.33333333%; }\n  .col-sm-6 {\n    width: 50%; }\n  .col-sm-5 {\n    width: 41.66666667%; }\n  .col-sm-4 {\n    width: 33.33333333%; }\n  .col-sm-3 {\n    width: 25%; }\n  .col-sm-2 {\n    width: 16.66666667%; }\n  .col-sm-1 {\n    width: 8.33333333%; }\n  .hide-sm {\n    display: none !important; }\n  .show-sm {\n    display: block !important; } }\n\n@media (max-width: 480px) {\n  .col-xs-12,\n  .col-xs-11,\n  .col-xs-10,\n  .col-xs-9,\n  .col-xs-8,\n  .col-xs-7,\n  .col-xs-6,\n  .col-xs-5,\n  .col-xs-4,\n  .col-xs-3,\n  .col-xs-2,\n  .col-xs-1 {\n    flex: none; }\n  .col-xs-12 {\n    width: 100%; }\n  .col-xs-11 {\n    width: 91.66666667%; }\n  .col-xs-10 {\n    width: 83.33333333%; }\n  .col-xs-9 {\n    width: 75%; }\n  .col-xs-8 {\n    width: 66.66666667%; }\n  .col-xs-7 {\n    width: 58.33333333%; }\n  .col-xs-6 {\n    width: 50%; }\n  .col-xs-5 {\n    width: 41.66666667%; }\n  .col-xs-4 {\n    width: 33.33333333%; }\n  .col-xs-3 {\n    width: 25%; }\n  .col-xs-2 {\n    width: 16.66666667%; }\n  .col-xs-1 {\n    width: 8.33333333%; }\n  .hide-xs {\n    display: none !important; }\n  .show-xs {\n    display: block !important; } }\n\n.navbar {\n  align-items: stretch;\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: space-between; }\n  .navbar .navbar-section {\n    align-items: center;\n    display: flex;\n    flex: 1 0 0; }\n    .navbar .navbar-section:not(:first-child):last-child {\n      justify-content: flex-end; }\n  .navbar .navbar-center {\n    align-items: center;\n    display: flex;\n    flex: 0 0 auto; }\n  .navbar .navbar-brand {\n    font-size: 0.9rem;\n    font-weight: 500;\n    text-decoration: none; }\n\n.accordion input:checked ~ .accordion-header .icon, .accordion[open] .accordion-header .icon {\n  transform: rotate(90deg); }\n\n.accordion input:checked ~ .accordion-body, .accordion[open] .accordion-body {\n  max-height: 50rem; }\n\n.accordion .accordion-header {\n  display: block;\n  padding: 0.2rem 0.4rem; }\n  .accordion .accordion-header .icon {\n    transition: all .2s ease; }\n\n.accordion .accordion-body {\n  margin-bottom: 0.4rem;\n  max-height: 0;\n  overflow: hidden;\n  transition: max-height .2s ease; }\n\nsummary.accordion-header::-webkit-details-marker {\n  display: none; }\n\n.avatar {\n  font-size: 0.8rem;\n  height: 1.6rem;\n  width: 1.6rem;\n  background: #5755d9;\n  border-radius: 50%;\n  color: rgba(255, 255, 255, 0.85);\n  display: inline-block;\n  font-weight: 300;\n  line-height: 1.25;\n  margin: 0;\n  position: relative;\n  vertical-align: middle; }\n  .avatar.avatar-xs {\n    font-size: 0.4rem;\n    height: 0.8rem;\n    width: 0.8rem; }\n  .avatar.avatar-sm {\n    font-size: 0.6rem;\n    height: 1.2rem;\n    width: 1.2rem; }\n  .avatar.avatar-lg {\n    font-size: 1.2rem;\n    height: 2.4rem;\n    width: 2.4rem; }\n  .avatar.avatar-xl {\n    font-size: 1.6rem;\n    height: 3.2rem;\n    width: 3.2rem; }\n  .avatar img {\n    border-radius: 50%;\n    height: 100%;\n    position: relative;\n    width: 100%;\n    z-index: 1; }\n  .avatar .avatar-icon,\n  .avatar .avatar-presence {\n    background: #fff;\n    bottom: 14.64%;\n    height: 50%;\n    padding: 0.1rem;\n    position: absolute;\n    right: 14.64%;\n    transform: translate(50%, 50%);\n    width: 50%;\n    z-index: 2; }\n  .avatar .avatar-presence {\n    background: #acb3c2;\n    box-shadow: 0 0 0 0.1rem #fff;\n    border-radius: 50%;\n    height: .5em;\n    width: .5em; }\n    .avatar .avatar-presence.online {\n      background: #32b643; }\n    .avatar .avatar-presence.busy {\n      background: #e85600; }\n    .avatar .avatar-presence.away {\n      background: #ffb700; }\n  .avatar[data-initial]::before {\n    color: currentColor;\n    content: attr(data-initial);\n    left: 50%;\n    position: absolute;\n    top: 50%;\n    transform: translate(-50%, -50%);\n    z-index: 1; }\n\n.badge {\n  position: relative;\n  white-space: nowrap; }\n  .badge[data-badge]::after, .badge:not([data-badge])::after {\n    background: #5755d9;\n    background-clip: padding-box;\n    border-radius: .5rem;\n    box-shadow: 0 0 0 0.1rem #fff;\n    color: #fff;\n    content: attr(data-badge);\n    display: inline-block;\n    transform: translate(-0.1rem, -0.5rem); }\n  .badge[data-badge]::after {\n    font-size: 0.7rem;\n    height: .9rem;\n    line-height: 1;\n    min-width: .9rem;\n    padding: .1rem .2rem;\n    text-align: center;\n    white-space: nowrap; }\n  .badge:not([data-badge])::after, .badge[data-badge=\"\"]::after {\n    height: 6px;\n    min-width: 6px;\n    padding: 0;\n    width: 6px; }\n  .badge.btn::after {\n    position: absolute;\n    top: 0;\n    right: 0;\n    transform: translate(50%, -50%); }\n  .badge.avatar::after {\n    position: absolute;\n    top: 14.64%;\n    right: 14.64%;\n    transform: translate(50%, -50%);\n    z-index: 100; }\n  .badge.avatar-xs::after {\n    content: \"\";\n    height: 0.4rem;\n    min-width: 0.4rem;\n    padding: 0;\n    width: 0.4rem; }\n\n.breadcrumb {\n  list-style: none;\n  margin: 0.2rem 0;\n  padding: 0.2rem 0; }\n  .breadcrumb .breadcrumb-item {\n    color: #667189;\n    display: inline-block;\n    margin: 0;\n    padding: 0.2rem 0; }\n    .breadcrumb .breadcrumb-item:not(:last-child) {\n      margin-right: 0.2rem; }\n      .breadcrumb .breadcrumb-item:not(:last-child) a {\n        color: #667189; }\n    .breadcrumb .breadcrumb-item:not(:first-child)::before {\n      color: #e7e9ed;\n      content: \"/\";\n      padding-right: 0.4rem; }\n\n.bar {\n  background: #f0f1f4;\n  border-radius: 0.1rem;\n  display: flex;\n  flex-wrap: nowrap;\n  height: 0.8rem;\n  width: 100%; }\n  .bar.bar-sm {\n    height: 0.2rem; }\n  .bar .bar-item {\n    background: #5755d9;\n    color: #fff;\n    display: block;\n    font-size: 0.7rem;\n    flex-shrink: 0;\n    line-height: 0.8rem;\n    height: 100%;\n    position: relative;\n    text-align: center;\n    width: 0; }\n    .bar .bar-item:first-child {\n      border-bottom-left-radius: 0.1rem;\n      border-top-left-radius: 0.1rem; }\n    .bar .bar-item:last-child {\n      border-bottom-right-radius: 0.1rem;\n      border-top-right-radius: 0.1rem;\n      flex-shrink: 1; }\n\n.bar-slider {\n  height: 0.1rem;\n  margin: 0.4rem 0;\n  position: relative; }\n  .bar-slider .bar-item {\n    left: 0;\n    padding: 0;\n    position: absolute; }\n    .bar-slider .bar-item:not(:last-child):first-child {\n      background: #f0f1f4;\n      z-index: 1; }\n  .bar-slider .bar-slider-btn {\n    background: #5755d9;\n    border: 0;\n    border-radius: 50%;\n    height: 0.6rem;\n    padding: 0;\n    position: absolute;\n    right: 0;\n    top: 50%;\n    transform: translate(50%, -50%);\n    width: 0.6rem; }\n    .bar-slider .bar-slider-btn:active {\n      box-shadow: 0 0 0 0.1rem #5755d9; }\n\n.card {\n  background: #fff;\n  border: 0.05rem solid #e7e9ed;\n  border-radius: 0.1rem;\n  display: flex;\n  flex-direction: column; }\n  .card .card-header,\n  .card .card-body,\n  .card .card-footer {\n    padding: 0.8rem;\n    padding-bottom: 0; }\n    .card .card-header:last-child,\n    .card .card-body:last-child,\n    .card .card-footer:last-child {\n      padding-bottom: 0.8rem; }\n  .card .card-image {\n    padding-top: 0.8rem; }\n    .card .card-image:first-child {\n      padding-top: 0; }\n      .card .card-image:first-child img {\n        border-top-left-radius: 0.1rem;\n        border-top-right-radius: 0.1rem; }\n    .card .card-image:last-child img {\n      border-bottom-left-radius: 0.1rem;\n      border-bottom-right-radius: 0.1rem; }\n\n.chip {\n  align-items: center;\n  background: #f0f1f4;\n  border-radius: 5rem;\n  color: #667189;\n  display: inline-flex;\n  font-size: 90%;\n  height: 1.2rem;\n  line-height: 0.8rem;\n  margin: 0.1rem;\n  max-width: 100%;\n  padding: 0.2rem 0.4rem;\n  text-decoration: none;\n  vertical-align: middle; }\n  .chip.active {\n    background: #5755d9;\n    color: #fff; }\n  .chip .avatar {\n    margin-left: -0.4rem;\n    margin-right: 0.2rem; }\n\n.dropdown {\n  display: inline-block;\n  position: relative; }\n  .dropdown .menu {\n    animation: slide-down .15s ease 1;\n    display: none;\n    left: 0;\n    max-height: 50vh;\n    overflow-y: auto;\n    position: absolute;\n    top: 100%; }\n  .dropdown.dropdown-right .menu {\n    left: auto;\n    right: 0; }\n  .dropdown.active .menu,\n  .dropdown .dropdown-toggle:focus + .menu,\n  .dropdown .menu:hover {\n    display: block; }\n  .dropdown .btn-group .dropdown-toggle:nth-last-child(2) {\n    border-bottom-right-radius: 0.1rem;\n    border-top-right-radius: 0.1rem; }\n\n.empty {\n  background: #f8f9fa;\n  border-radius: 0.1rem;\n  color: #667189;\n  text-align: center;\n  padding: 3.2rem 1.6rem; }\n  .empty .empty-icon {\n    margin-bottom: 0.8rem; }\n  .empty .empty-title,\n  .empty .empty-subtitle {\n    margin: 0.4rem auto; }\n  .empty .empty-action {\n    margin-top: 0.8rem; }\n\n.menu {\n  box-shadow: 0 0.05rem 0.2rem rgba(69, 77, 93, 0.3);\n  background: #fff;\n  border-radius: 0.1rem;\n  list-style: none;\n  margin: 0;\n  min-width: 180px;\n  padding: 0.4rem;\n  transform: translateY(0.2rem);\n  z-index: 300; }\n  .menu.menu-nav {\n    background: transparent;\n    box-shadow: none; }\n  .menu .menu-item {\n    margin-top: 0;\n    padding: 0 0.4rem;\n    text-decoration: none;\n    user-select: none; }\n    .menu .menu-item > a {\n      border-radius: 0.1rem;\n      color: inherit;\n      display: block;\n      margin: 0 -0.4rem;\n      padding: 0.2rem 0.4rem;\n      text-decoration: none; }\n      .menu .menu-item > a:focus, .menu .menu-item > a:hover {\n        background: #f1f1fc;\n        color: #5755d9; }\n      .menu .menu-item > a:active, .menu .menu-item > a.active {\n        background: #f1f1fc;\n        color: #5755d9; }\n    .menu .menu-item .form-checkbox,\n    .menu .menu-item .form-radio,\n    .menu .menu-item .form-switch {\n      margin: 0.1rem 0; }\n    .menu .menu-item + .menu-item {\n      margin-top: 0.2rem; }\n  .menu .menu-badge {\n    float: right;\n    padding: 0.2rem 0; }\n    .menu .menu-badge .btn {\n      margin-top: -0.1rem; }\n\n.modal {\n  align-items: center;\n  bottom: 0;\n  display: none;\n  justify-content: center;\n  left: 0;\n  opacity: 0;\n  overflow: hidden;\n  padding: 0.4rem;\n  position: fixed;\n  right: 0;\n  top: 0; }\n  .modal:target, .modal.active {\n    display: flex;\n    opacity: 1;\n    z-index: 400; }\n    .modal:target .modal-overlay, .modal.active .modal-overlay {\n      background: rgba(248, 249, 250, 0.75);\n      bottom: 0;\n      cursor: default;\n      display: block;\n      left: 0;\n      position: absolute;\n      right: 0;\n      top: 0; }\n    .modal:target .modal-container, .modal.active .modal-container {\n      animation: slide-down .2s ease 1;\n      max-width: 640px;\n      width: 100%;\n      z-index: 1; }\n  .modal.modal-sm .modal-container {\n    max-width: 320px;\n    padding: 0 0.4rem; }\n  .modal.modal-lg .modal-overlay {\n    background: #fff; }\n  .modal.modal-lg .modal-container {\n    box-shadow: none;\n    max-width: 960px; }\n\n.modal-container {\n  box-shadow: 0 0.2rem 0.5rem rgba(69, 77, 93, 0.3);\n  background: #fff;\n  border-radius: 0.1rem;\n  display: block;\n  padding: 0 0.8rem; }\n  .modal-container .modal-header {\n    padding: 0.8rem; }\n  .modal-container .modal-body {\n    max-height: 50vh;\n    overflow-y: auto;\n    padding: 0.8rem;\n    position: relative; }\n  .modal-container .modal-footer {\n    padding: 0.8rem;\n    text-align: right; }\n\n.nav {\n  display: flex;\n  flex-direction: column;\n  list-style: none;\n  margin: 0.2rem 0; }\n  .nav .nav-item a {\n    color: #667189;\n    padding: 0.2rem 0.4rem;\n    text-decoration: none; }\n    .nav .nav-item a:focus, .nav .nav-item a:hover {\n      color: #5755d9; }\n  .nav .nav-item.active > a {\n    color: #50596c;\n    font-weight: bold; }\n    .nav .nav-item.active > a:focus, .nav .nav-item.active > a:hover {\n      color: #5755d9; }\n  .nav .nav {\n    margin-bottom: 0.4rem;\n    margin-left: 0.8rem; }\n\n.pagination {\n  display: flex;\n  list-style: none;\n  margin: 0.2rem 0;\n  padding: 0.2rem 0; }\n  .pagination .page-item {\n    margin: 0.2rem 0.05rem; }\n    .pagination .page-item span {\n      display: inline-block;\n      padding: 0.2rem 0.2rem; }\n    .pagination .page-item a {\n      border-radius: 0.1rem;\n      color: #667189;\n      display: inline-block;\n      padding: 0.2rem 0.4rem;\n      text-decoration: none; }\n      .pagination .page-item a:focus, .pagination .page-item a:hover {\n        color: #5755d9; }\n    .pagination .page-item.disabled a {\n      cursor: default;\n      opacity: .5;\n      pointer-events: none; }\n    .pagination .page-item.active a {\n      background: #5755d9;\n      color: #fff; }\n    .pagination .page-item.page-prev, .pagination .page-item.page-next {\n      flex: 1 0 50%; }\n    .pagination .page-item.page-next {\n      text-align: right; }\n    .pagination .page-item .page-item-title {\n      margin: 0; }\n    .pagination .page-item .page-item-subtitle {\n      margin: 0;\n      opacity: .5; }\n\n.panel {\n  border: 0.05rem solid #e7e9ed;\n  border-radius: 0.1rem;\n  display: flex;\n  flex-direction: column; }\n  .panel .panel-header,\n  .panel .panel-footer {\n    flex: 0 0 auto;\n    padding: 0.8rem; }\n  .panel .panel-nav {\n    flex: 0 0 auto; }\n  .panel .panel-body {\n    flex: 1 1 auto;\n    overflow-y: auto;\n    padding: 0 0.8rem; }\n\n.popover {\n  display: inline-block;\n  position: relative; }\n  .popover .popover-container {\n    left: 50%;\n    opacity: 0;\n    padding: 0.4rem;\n    position: absolute;\n    top: 0;\n    transform: translate(-50%, -50%) scale(0);\n    transition: transform .2s ease;\n    width: 320px;\n    z-index: 300; }\n  .popover *:focus + .popover-container,\n  .popover:hover .popover-container,\n  .popover .popover-container:hover {\n    display: block;\n    opacity: 1;\n    transform: translate(-50%, -100%) scale(1); }\n  .popover.popover-right .popover-container {\n    left: 100%;\n    top: 50%; }\n  .popover.popover-right :focus + .popover-container,\n  .popover.popover-right:hover .popover-container,\n  .popover.popover-right .popover-container:hover {\n    transform: translate(0, -50%) scale(1); }\n  .popover.popover-bottom .popover-container {\n    left: 50%;\n    top: 100%; }\n  .popover.popover-bottom :focus + .popover-container,\n  .popover.popover-bottom:hover .popover-container,\n  .popover.popover-bottom .popover-container:hover {\n    transform: translate(-50%, 0) scale(1); }\n  .popover.popover-left .popover-container {\n    left: 0;\n    top: 50%; }\n  .popover.popover-left :focus + .popover-container,\n  .popover.popover-left:hover .popover-container,\n  .popover.popover-left .popover-container:hover {\n    transform: translate(-100%, -50%) scale(1); }\n  .popover .card {\n    box-shadow: 0 0.2rem 0.5rem rgba(69, 77, 93, 0.3);\n    border: 0; }\n\n.step {\n  display: flex;\n  flex-wrap: nowrap;\n  list-style: none;\n  margin: 0.2rem 0;\n  width: 100%; }\n  .step .step-item {\n    flex: 1 1 0;\n    margin-top: 0;\n    min-height: 1rem;\n    text-align: center;\n    position: relative; }\n    .step .step-item:not(:first-child)::before {\n      background: #5755d9;\n      content: \"\";\n      height: 2px;\n      left: -50%;\n      position: absolute;\n      top: 9px;\n      width: 100%; }\n    .step .step-item a {\n      color: #acb3c2;\n      display: inline-block;\n      padding: 20px 10px 0;\n      text-decoration: none; }\n      .step .step-item a::before {\n        background: #5755d9;\n        border: 0.1rem solid #fff;\n        border-radius: 50%;\n        content: \"\";\n        display: block;\n        height: 0.6rem;\n        left: 50%;\n        position: absolute;\n        top: 0.2rem;\n        transform: translateX(-50%);\n        width: 0.6rem;\n        z-index: 1; }\n    .step .step-item.active a::before {\n      background: #fff;\n      border: 0.1rem solid #5755d9; }\n    .step .step-item.active ~ .step-item::before {\n      background: #e7e9ed; }\n    .step .step-item.active ~ .step-item a::before {\n      background: #e7e9ed; }\n\n.tab {\n  align-items: center;\n  border-bottom: 0.05rem solid #e7e9ed;\n  display: flex;\n  flex-wrap: wrap;\n  list-style: none;\n  margin: 0.2rem 0 0.15rem 0; }\n  .tab .tab-item {\n    margin-top: 0; }\n    .tab .tab-item a {\n      border-bottom: 0.1rem solid transparent;\n      color: inherit;\n      display: block;\n      margin: 0 0.4rem 0 0;\n      padding: 0.4rem 0.2rem 0.3rem 0.2rem;\n      text-decoration: none; }\n      .tab .tab-item a:focus, .tab .tab-item a:hover {\n        color: #5755d9; }\n    .tab .tab-item.active a,\n    .tab .tab-item a.active {\n      border-bottom-color: #5755d9;\n      color: #5755d9; }\n    .tab .tab-item.tab-action {\n      flex: 1 0 auto;\n      text-align: right; }\n    .tab .tab-item .btn-clear {\n      margin-top: -0.2rem; }\n  .tab.tab-block .tab-item {\n    flex: 1 0 0;\n    text-align: center; }\n    .tab.tab-block .tab-item a {\n      margin: 0; }\n    .tab.tab-block .tab-item .badge[data-badge]::after {\n      position: absolute;\n      right: 0.1rem;\n      top: 0.1rem;\n      transform: translate(0, 0); }\n  .tab:not(.tab-block) .badge {\n    padding-right: 0; }\n\n.tile {\n  align-content: space-between;\n  align-items: flex-start;\n  display: flex; }\n  .tile .tile-icon,\n  .tile .tile-action {\n    flex: 0 0 auto; }\n  .tile .tile-content {\n    flex: 1 1 auto; }\n    .tile .tile-content:not(:first-child) {\n      padding-left: 0.4rem; }\n    .tile .tile-content:not(:last-child) {\n      padding-right: 0.4rem; }\n  .tile .tile-title,\n  .tile .tile-subtitle {\n    line-height: 1rem; }\n  .tile.tile-centered {\n    align-items: center; }\n    .tile.tile-centered .tile-content {\n      overflow: hidden; }\n    .tile.tile-centered .tile-title,\n    .tile.tile-centered .tile-subtitle {\n      overflow: hidden;\n      text-overflow: ellipsis;\n      white-space: nowrap;\n      margin-bottom: 0; }\n\n.toast {\n  background: rgba(69, 77, 93, 0.9);\n  border-color: #454d5d;\n  border: 0.05rem solid #454d5d;\n  border-radius: 0.1rem;\n  color: #fff;\n  display: block;\n  padding: 0.4rem;\n  width: 100%; }\n  .toast.toast-primary {\n    background: rgba(87, 85, 217, 0.9);\n    border-color: #5755d9; }\n  .toast.toast-success {\n    background: rgba(50, 182, 67, 0.9);\n    border-color: #32b643; }\n  .toast.toast-warning {\n    background: rgba(255, 183, 0, 0.9);\n    border-color: #ffb700; }\n  .toast.toast-error {\n    background: rgba(232, 86, 0, 0.9);\n    border-color: #e85600; }\n  .toast a {\n    color: #fff;\n    text-decoration: underline; }\n    .toast a:focus, .toast a:hover, .toast a:active, .toast a.active {\n      opacity: .75; }\n  .toast .btn-clear {\n    margin: 4px -2px 4px 4px; }\n\n.tooltip {\n  position: relative; }\n  .tooltip::after {\n    background: rgba(69, 77, 93, 0.9);\n    border-radius: 0.1rem;\n    bottom: 100%;\n    color: #fff;\n    content: attr(data-tooltip);\n    display: block;\n    font-size: 0.7rem;\n    left: 50%;\n    max-width: 320px;\n    opacity: 0;\n    overflow: hidden;\n    padding: 0.2rem 0.4rem;\n    pointer-events: none;\n    position: absolute;\n    text-overflow: ellipsis;\n    transform: translate(-50%, 0.4rem);\n    transition: all .2s ease;\n    white-space: pre;\n    z-index: 300; }\n  .tooltip:focus::after, .tooltip:hover::after {\n    opacity: 1;\n    transform: translate(-50%, -0.2rem); }\n  .tooltip[disabled], .tooltip.disabled {\n    pointer-events: auto; }\n  .tooltip.tooltip-right::after {\n    bottom: 50%;\n    left: 100%;\n    transform: translate(-0.2rem, 50%); }\n  .tooltip.tooltip-right:focus::after, .tooltip.tooltip-right:hover::after {\n    transform: translate(0.2rem, 50%); }\n  .tooltip.tooltip-bottom::after {\n    bottom: auto;\n    top: 100%;\n    transform: translate(-50%, -0.4rem); }\n  .tooltip.tooltip-bottom:focus::after, .tooltip.tooltip-bottom:hover::after {\n    transform: translate(-50%, 0.2rem); }\n  .tooltip.tooltip-left::after {\n    bottom: 50%;\n    left: auto;\n    right: 100%;\n    transform: translate(0.4rem, 50%); }\n  .tooltip.tooltip-left:focus::after, .tooltip.tooltip-left:hover::after {\n    transform: translate(-0.2rem, 50%); }\n\n@keyframes loading {\n  0% {\n    transform: rotate(0deg); }\n  100% {\n    transform: rotate(360deg); } }\n\n@keyframes slide-down {\n  0% {\n    opacity: 0;\n    transform: translateY(-1.6rem); }\n  100% {\n    opacity: 1;\n    transform: translateY(0); } }\n\n.text-primary {\n  color: #5755d9; }\n\na.text-primary:focus, a.text-primary:hover {\n  color: #4240d4; }\n\n.text-secondary {\n  color: #e5e5f9; }\n\na.text-secondary:focus, a.text-secondary:hover {\n  color: #d1d0f4; }\n\n.text-gray {\n  color: #acb3c2; }\n\na.text-gray:focus, a.text-gray:hover {\n  color: #9ea6b7; }\n\n.text-light {\n  color: #fff; }\n\na.text-light:focus, a.text-light:hover {\n  color: #f2f2f2; }\n\n.text-success {\n  color: #32b643; }\n\na.text-success:focus, a.text-success:hover {\n  color: #2da23c; }\n\n.text-warning {\n  color: #ffb700; }\n\na.text-warning:focus, a.text-warning:hover {\n  color: #e6a500; }\n\n.text-error {\n  color: #e85600; }\n\na.text-error:focus, a.text-error:hover {\n  color: #cf4d00; }\n\n.bg-primary {\n  background: #5755d9;\n  color: #fff; }\n\n.bg-secondary {\n  background: #f1f1fc; }\n\n.bg-dark {\n  background: #454d5d;\n  color: #fff; }\n\n.bg-gray {\n  background: #f8f9fa; }\n\n.bg-success {\n  background: #32b643;\n  color: #fff; }\n\n.bg-warning {\n  background: #ffb700;\n  color: #fff; }\n\n.bg-error {\n  background: #e85600;\n  color: #fff; }\n\n.c-hand {\n  cursor: pointer; }\n\n.c-move {\n  cursor: move; }\n\n.c-zoom-in {\n  cursor: zoom-in; }\n\n.c-zoom-out {\n  cursor: zoom-out; }\n\n.c-not-allowed {\n  cursor: not-allowed; }\n\n.c-auto {\n  cursor: auto; }\n\n.d-block {\n  display: block; }\n\n.d-inline {\n  display: inline; }\n\n.d-inline-block {\n  display: inline-block; }\n\n.d-flex {\n  display: flex; }\n\n.d-inline-flex {\n  display: inline-flex; }\n\n.d-none,\n.d-hide {\n  display: none !important; }\n\n.d-visible {\n  visibility: visible; }\n\n.d-invisible {\n  visibility: hidden; }\n\n.text-hide {\n  background: transparent;\n  border: 0;\n  color: transparent;\n  font-size: 0;\n  line-height: 0;\n  text-shadow: none; }\n\n.text-assistive {\n  border: 0;\n  clip: rect(0, 0, 0, 0);\n  height: 1px;\n  margin: -1px;\n  overflow: hidden;\n  padding: 0;\n  position: absolute;\n  width: 1px; }\n\n.divider,\n.divider-vert {\n  display: block;\n  position: relative; }\n  .divider[data-content]::after,\n  .divider-vert[data-content]::after {\n    background: #fff;\n    color: #acb3c2;\n    content: attr(data-content);\n    display: inline-block;\n    font-size: 0.7rem;\n    padding: 0 0.4rem;\n    transform: translateY(-0.65rem); }\n\n.divider {\n  border-top: 0.05rem solid #e7e9ed;\n  height: 0.05rem;\n  margin: 0.4rem 0; }\n  .divider[data-content] {\n    margin: 0.8rem 0; }\n\n.divider-vert {\n  display: block;\n  padding: 0.8rem; }\n  .divider-vert::before {\n    border-left: 0.05rem solid #e7e9ed;\n    bottom: 0.4rem;\n    content: \"\";\n    display: block;\n    left: 50%;\n    position: absolute;\n    top: 0.4rem;\n    transform: translateX(-50%); }\n  .divider-vert[data-content]::after {\n    left: 50%;\n    padding: 0.2rem 0;\n    position: absolute;\n    top: 50%;\n    transform: translate(-50%, -50%); }\n\n.loading {\n  color: transparent !important;\n  min-height: 0.8rem;\n  pointer-events: none;\n  position: relative; }\n  .loading::after {\n    animation: loading 500ms infinite linear;\n    border: 0.1rem solid #5755d9;\n    border-radius: 50%;\n    border-right-color: transparent;\n    border-top-color: transparent;\n    content: \"\";\n    display: block;\n    height: 0.8rem;\n    left: 50%;\n    margin-left: -0.4rem;\n    margin-top: -0.4rem;\n    position: absolute;\n    top: 50%;\n    width: 0.8rem;\n    z-index: 1; }\n  .loading.loading-lg {\n    min-height: 2rem; }\n    .loading.loading-lg::after {\n      height: 1.6rem;\n      margin-left: -0.8rem;\n      margin-top: -0.8rem;\n      width: 1.6rem; }\n\n.clearfix::after, .container::after {\n  clear: both;\n  content: \"\";\n  display: table; }\n\n.float-left {\n  float: left !important; }\n\n.float-right {\n  float: right !important; }\n\n.relative {\n  position: relative; }\n\n.absolute {\n  position: absolute; }\n\n.fixed {\n  position: fixed; }\n\n.centered {\n  display: block;\n  float: none;\n  margin-left: auto;\n  margin-right: auto; }\n\n.flex-centered {\n  align-items: center;\n  display: flex;\n  justify-content: center; }\n\n.m-0 {\n  margin: 0; }\n\n.mb-0 {\n  margin-bottom: 0; }\n\n.ml-0 {\n  margin-left: 0; }\n\n.mr-0 {\n  margin-right: 0; }\n\n.mt-0 {\n  margin-top: 0; }\n\n.mx-0 {\n  margin-left: 0;\n  margin-right: 0; }\n\n.my-0 {\n  margin-bottom: 0;\n  margin-top: 0; }\n\n.m-1 {\n  margin: 0.2rem; }\n\n.mb-1 {\n  margin-bottom: 0.2rem; }\n\n.ml-1 {\n  margin-left: 0.2rem; }\n\n.mr-1 {\n  margin-right: 0.2rem; }\n\n.mt-1 {\n  margin-top: 0.2rem; }\n\n.mx-1 {\n  margin-left: 0.2rem;\n  margin-right: 0.2rem; }\n\n.my-1 {\n  margin-bottom: 0.2rem;\n  margin-top: 0.2rem; }\n\n.m-2 {\n  margin: 0.4rem; }\n\n.mb-2 {\n  margin-bottom: 0.4rem; }\n\n.ml-2 {\n  margin-left: 0.4rem; }\n\n.mr-2 {\n  margin-right: 0.4rem; }\n\n.mt-2 {\n  margin-top: 0.4rem; }\n\n.mx-2 {\n  margin-left: 0.4rem;\n  margin-right: 0.4rem; }\n\n.my-2 {\n  margin-bottom: 0.4rem;\n  margin-top: 0.4rem; }\n\n.p-0 {\n  padding: 0; }\n\n.pb-0 {\n  padding-bottom: 0; }\n\n.pl-0 {\n  padding-left: 0; }\n\n.pr-0 {\n  padding-right: 0; }\n\n.pt-0 {\n  padding-top: 0; }\n\n.px-0 {\n  padding-left: 0;\n  padding-right: 0; }\n\n.py-0 {\n  padding-bottom: 0;\n  padding-top: 0; }\n\n.p-1 {\n  padding: 0.2rem; }\n\n.pb-1 {\n  padding-bottom: 0.2rem; }\n\n.pl-1 {\n  padding-left: 0.2rem; }\n\n.pr-1 {\n  padding-right: 0.2rem; }\n\n.pt-1 {\n  padding-top: 0.2rem; }\n\n.px-1 {\n  padding-left: 0.2rem;\n  padding-right: 0.2rem; }\n\n.py-1 {\n  padding-bottom: 0.2rem;\n  padding-top: 0.2rem; }\n\n.p-2 {\n  padding: 0.4rem; }\n\n.pb-2 {\n  padding-bottom: 0.4rem; }\n\n.pl-2 {\n  padding-left: 0.4rem; }\n\n.pr-2 {\n  padding-right: 0.4rem; }\n\n.pt-2 {\n  padding-top: 0.4rem; }\n\n.px-2 {\n  padding-left: 0.4rem;\n  padding-right: 0.4rem; }\n\n.py-2 {\n  padding-bottom: 0.4rem;\n  padding-top: 0.4rem; }\n\n.rounded {\n  border-radius: 0.1rem; }\n\n.circle {\n  border-radius: 50%; }\n\n.text-left {\n  text-align: left; }\n\n.text-right {\n  text-align: right; }\n\n.text-center {\n  text-align: center; }\n\n.text-justify {\n  text-align: justify; }\n\n.text-lowercase {\n  text-transform: lowercase; }\n\n.text-uppercase {\n  text-transform: uppercase; }\n\n.text-capitalize {\n  text-transform: capitalize; }\n\n.text-normal {\n  font-weight: normal; }\n\n.text-bold {\n  font-weight: bold; }\n\n.text-italic {\n  font-style: italic; }\n\n.text-large {\n  font-size: 1.2em; }\n\n.text-ellipsis {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap; }\n\n.text-clip {\n  overflow: hidden;\n  text-overflow: clip;\n  white-space: nowrap; }\n\n.text-break {\n  hyphens: auto;\n  word-break: break-word;\n  word-wrap: break-word; }\n\n.scrollable {\n  display: flex;\n  flex-direction: column; }\n  .scrollable .scrollable-content {\n    overflow-x: auto;\n    overflow-y: auto;\n    min-height: 0px;\n    flex-grow: 1; }\n";
styleInject(css);

var css$2 = "";
styleInject(css$2);

function DebuggerOptions(props) {
    var state = props.state, actions = props.actions;
    return (h("div", { class: "debugger-options" },
        h("div", { class: "form-group option" },
            h("label", { class: "form-checkbox" },
                h("input", { type: "checkbox", checked: state.collapseRepeatingActions, onchange: actions.toggleCollapseRepeatingActions }),
                h("i", { class: "form-icon" }),
                " Group repeating actions")),
        h("div", { class: "form-group option" },
            h("select", { class: "form-select", onchange: function (e) { return actions.setValueDisplay(e.target.value); }, value: state.valueDisplay },
                h("option", { value: "state" }, "Show Full State"),
                h("option", { value: "result" }, "Show Action Result"),
                h("option", { value: "data" }, "Show Action Data")))));
}
/* <label class="form-checkbox">
<input
  type="checkbox"
  checked={state.showFullState}
  onchange={actions.toggleShowFullState}
/>
<i class="form-icon" /> Show full state
</label> */

var css$4 = ".debug-pane {\n  display: flex;\n  flex-direction: column;\n  width: 100%;\n  height: 100%;\n  background: #fefefe;\n  border: 1px solid black;\n  color: black; }\n  .debug-pane .debug-toolbar {\n    display: flex;\n    justify-content: space-between;\n    flex-shrink: 0;\n    width: 100%;\n    border-bottom: 1px solid black; }\n    .debug-pane .debug-toolbar .close-button {\n      margin: 0.4rem; }\n  .debug-pane .debug-content {\n    flex-grow: 1; }\n    .debug-pane .debug-content pre {\n      margin: 0rem; }\n";
styleInject(css$4);

function Toolbar(props) {
    var state = props.state, actions = props.actions;
    return (h("div", { class: "debug-toolbar" },
        h("div", { class: "dropdown" },
            h("button", { class: "btn btn-link dropdown-toggle" }, "View"),
            h("ul", { class: "menu" },
                h("li", { class: "menu-item" },
                    h("a", { href: "", onclick: function (e) {
                            actions.setPaneDisplay("fullscreen");
                            e.preventDefault();
                        } }, "Full Screen")),
                h("li", { class: "menu-item" },
                    h("a", { href: "", onclick: function (e) {
                            actions.setPaneDisplay("right");
                            e.preventDefault();
                        } }, "Align Right")),
                h("li", { class: "menu-item" },
                    h("a", { href: "", onclick: function (e) {
                            actions.setPaneDisplay("bottom");
                            e.preventDefault();
                        } }, "Align Bottom")))),
        h("span", { class: "float-right" },
            h("button", { class: "btn btn-clear close-button", onclick: function () { return actions.showPane(false); } }))));
}
function DebugPane(props) {
    var state = props.state, actions = props.actions;
    return (h("div", { class: "debug-pane" },
        Toolbar({ state: state, actions: actions }),
        DebuggerOptions({ state: state, actions: actions }),
        h("div", { class: "debug-content scrollable" },
            h("pre", { class: "scrollable-content" }, JSON.stringify(state, null, 2)))));
}

var css$6 = ".toggle-pane-button {\n  position: fixed;\n  right: 2%;\n  bottom: 2%; }\n  .toggle-pane-button:hover {\n    background: #efefef; }\n  .toggle-pane-button:active {\n    background: #dddddd; }\n";
styleInject(css$6);

function TogglePaneButton(props) {
    var state = props.state, actions = props.actions;
    return (h("button", { class: "btn toggle-pane-button", onclick: function () { return actions.showPane(!state.paneShown); } }, "Devtools"));
}

var css$8 = ".devtools-overlay {\n  position: fixed;\n  top: 0;\n  left: 0;\n  height: 100vh;\n  width: 100vw;\n  z-index: 10; }\n  .devtools-overlay.align-right {\n    width: 50vw;\n    left: 50vw; }\n  .devtools-overlay.align-bottom {\n    height: 50vh;\n    top: 50vh; }\n";
styleInject(css$8);

function getClassName(display) {
    switch (display) {
        case "fullscreen":
            return "devtools-overlay";
        case "right":
            return "devtools-overlay align-right";
        case "bottom":
            return "devtools-overlay align-bottom";
    }
}
function view(state, actions) {
    if (state.paneShown) {
        return (h("div", { class: getClassName(state.paneDisplay) },
            DebugPane({ state: state, actions: actions }),
            TogglePaneButton({ state: state, actions: actions })));
    }
    return TogglePaneButton({ state: state, actions: actions });
}

function enhanceActions(onAction, runId, actions, prefix) {
    var namespace = prefix ? prefix + "." : "";
    return Object.keys(actions || {}).reduce(function (otherActions, name) {
        var namedspacedName = namespace + name;
        var action = actions[name];
        otherActions[name] =
            typeof action === "function"
                ? function (data) {
                    return function (state, actions) {
                        onAction({
                            callDone: false,
                            action: namedspacedName,
                            data: data,
                            runId: runId
                        });
                        var result = action(data);
                        result =
                            typeof result === "function" ? result(state, actions) : result;
                        onAction({
                            callDone: true,
                            action: namedspacedName,
                            data: data,
                            result: result,
                            runId: runId
                        });
                        return result;
                    };
                }
                : enhanceActions(onAction, runId, action, namedspacedName);
        return otherActions;
    }, {});
}

var ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
var SIZE = 16;
var rand = function () { return ALPHABET[Math.floor(Math.random() * ALPHABET.length)]; };
var guid = function () {
    return Array.apply(null, Array(SIZE))
        .map(rand)
        .join("");
};
function hoa$1(app) {
    var div = document.createElement("div");
    div.id = "hyperapp-devtools";
    document.body.appendChild(div);
    var devtoolsApp = app(state, actions, view, div);
    return function (state$$1, actions$$1, view$$1, element) {
        var runId = guid();
        actions$$1 = enhanceActions(devtoolsApp.logAction, runId, actions$$1);
        actions$$1.$__SET_STATE = function (state$$1) { return state$$1; };
        devtoolsApp.logInit({ runId: runId, state: state$$1, timestamp: new Date().getTime() });
        return app(state$$1, actions$$1, view$$1, element);
    };
}

export default hoa$1;
//# sourceMappingURL=hyperapp-devtools.es.js.map
