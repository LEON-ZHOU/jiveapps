// Some things are using array.indexOf, which IE7 and IE8 don't support, so add it
if (!Array.prototype.indexOf)
{
  Array.prototype.indexOf = function(elt /*, from*/)
  {
    var len = this.length >>> 0;

    var from = Number(arguments[1]) || 0;
    from = (from < 0)
         ? Math.ceil(from)
         : Math.floor(from);
    if (from < 0)
      from += len;

    for (; from < len; from++)
    {
      if (from in this &&
          this[from] === elt)
        return from;
    }
    return -1;
  };
}

/*
 * Copyright 2008 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview
 * Utility functions and classes for Soy.
 *
 * <p>
 * The top portion of this file contains utilities for Soy users:<ul>
 *   <li> soy.StringBuilder: Compatible with the 'stringbuilder' code style.
 *   <li> soy.renderElement: Render template and set as innerHTML of an element.
 *   <li> soy.renderAsFragment: Render template and return as HTML fragment.
 * </ul>
 *
 * <p>
 * The bottom portion of this file contains utilities that should only be called
 * by Soy-generated JS code. Please do not use these functions directly from
 * your hand-writen code. Their names all start with '$$'.
 *
 * @author Garrett Boyer
 * @author Mike Samuel
 * @author Kai Huang
 * @author Aharon Lanin
 */


// COPIED FROM nogoog_shim.js

// Create closure namespaces.
var goog = goog || {};


goog.DEBUG = false;


goog.inherits = function(childCtor, parentCtor) {
  /** @constructor */
  function tempCtor() {}
  tempCtor.prototype = parentCtor.prototype;
  childCtor.superClass_ = parentCtor.prototype;
  childCtor.prototype = new tempCtor();
  childCtor.prototype.constructor = childCtor;
};


// Just enough browser detection for this file.
if (!goog.userAgent) {
  goog.userAgent = (function() {
    var userAgent = "";
    if ("undefined" !== typeof navigator && navigator
        && "string" == typeof navigator.userAgent) {
      userAgent = navigator.userAgent;
    }
    var isOpera = userAgent.indexOf('Opera') == 0;
    return {
      jscript: {
        /**
         * @type {boolean}
         */
        HAS_JSCRIPT: 'ScriptEngine' in this
      },
      /**
       * @type {boolean}
       */
      OPERA: isOpera,
      /**
       * @type {boolean}
       */
      IE: !isOpera && userAgent.indexOf('MSIE') != -1,
      /**
       * @type {boolean}
       */
      WEBKIT: !isOpera && userAgent.indexOf('WebKit') != -1
    };
  })();
}

if (!goog.asserts) {
  goog.asserts = {
    /**
     * @param {*} condition Condition to check.
     */
    assert: function (condition) {
      if (!condition) {
        throw Error('Assertion error');
      }
    },
    /**
     * @param {...*} var_args
     */
    fail: function (var_args) {}
  };
}


// Stub out the document wrapper used by renderAs*.
if (!goog.dom) {
  goog.dom = {};
  /**
   * @param {Document=} d
   * @constructor
   */
  goog.dom.DomHelper = function(d) {
    this.document_ = d || document;
  };
  /**
   * @return {!Document}
   */
  goog.dom.DomHelper.prototype.getDocument = function() {
    return this.document_;
  };
  /**
   * Creates a new element.
   * @param {string} name Tag name.
   * @return {!Element}
   */
  goog.dom.DomHelper.prototype.createElement = function(name) {
    return this.document_.createElement(name);
  };
  /**
   * Creates a new document fragment.
   * @return {!DocumentFragment}
   */
  goog.dom.DomHelper.prototype.createDocumentFragment = function() {
    return this.document_.createDocumentFragment();
  };
}


if (!goog.format) {
  goog.format = {
    insertWordBreaks: function(str, maxCharsBetweenWordBreaks) {
      str = String(str);

      var resultArr = [];
      var resultArrLen = 0;

      // These variables keep track of important state inside str.
      var isInTag = false;  // whether we're inside an HTML tag
      var isMaybeInEntity = false;  // whether we might be inside an HTML entity
      var numCharsWithoutBreak = 0;  // number of chars since last word break
      var flushIndex = 0;  // index of first char not yet flushed to resultArr

      for (var i = 0, n = str.length; i < n; ++i) {
        var charCode = str.charCodeAt(i);

        // If hit maxCharsBetweenWordBreaks, and not space next, then add <wbr>.
        if (numCharsWithoutBreak >= maxCharsBetweenWordBreaks &&
            // space
            charCode != 32) {
          resultArr[resultArrLen++] = str.substring(flushIndex, i);
          flushIndex = i;
          resultArr[resultArrLen++] = goog.format.WORD_BREAK;
          numCharsWithoutBreak = 0;
        }

        if (isInTag) {
          // If inside an HTML tag and we see '>', it's the end of the tag.
          if (charCode == 62) {
            isInTag = false;
          }

        } else if (isMaybeInEntity) {
          switch (charCode) {
            // Inside an entity, a ';' is the end of the entity.
            // The entity that just ended counts as one char, so increment
            // numCharsWithoutBreak.
          case 59:  // ';'
            isMaybeInEntity = false;
            ++numCharsWithoutBreak;
            break;
            // If maybe inside an entity and we see '<', we weren't actually in
            // an entity. But now we're inside and HTML tag.
          case 60:  // '<'
            isMaybeInEntity = false;
            isInTag = true;
            break;
            // If maybe inside an entity and we see ' ', we weren't actually in
            // an entity. Just correct the state and reset the
            // numCharsWithoutBreak since we just saw a space.
          case 32:  // ' '
            isMaybeInEntity = false;
            numCharsWithoutBreak = 0;
            break;
          }

        } else {  // !isInTag && !isInEntity
          switch (charCode) {
            // When not within a tag or an entity and we see '<', we're now
            // inside an HTML tag.
          case 60:  // '<'
            isInTag = true;
            break;
            // When not within a tag or an entity and we see '&', we might be
            // inside an entity.
          case 38:  // '&'
            isMaybeInEntity = true;
            break;
            // When we see a space, reset the numCharsWithoutBreak count.
          case 32:  // ' '
            numCharsWithoutBreak = 0;
            break;
            // When we see a non-space, increment the numCharsWithoutBreak.
          default:
            ++numCharsWithoutBreak;
            break;
          }
        }
      }

      // Flush the remaining chars at the end of the string.
      resultArr[resultArrLen++] = str.substring(flushIndex);

      return resultArr.join('');
    },
    /**
     * String inserted as a word break by insertWordBreaks(). Safari requires
     * <wbr></wbr>, Opera needs the 'shy' entity, though this will give a
     * visible hyphen at breaks. Other browsers just use <wbr>.
     * @type {string}
     * @private
     */
    WORD_BREAK: goog.userAgent.WEBKIT
        ? '<wbr></wbr>' : goog.userAgent.OPERA ? '&shy;' : '<wbr>'
  };
}


if (!goog.i18n) {
  goog.i18n = {
    bidi: {
      /**
       * Check the directionality of a piece of text, return true if the piece
       * of text should be laid out in RTL direction.
       * @param {string} text The piece of text that need to be detected.
       * @param {boolean=} opt_isHtml Whether {@code text} is HTML/HTML-escaped.
       *     Default: false.
       * @return {boolean}
       * @private
       */
      detectRtlDirectionality: function(text, opt_isHtml) {
        text = soyshim.$$bidiStripHtmlIfNecessary_(text, opt_isHtml);
        return soyshim.$$bidiRtlWordRatio_(text)
            > soyshim.$$bidiRtlDetectionThreshold_;
      }
    }
  };
}

/**
 * Directionality enum.
 * @enum {number}
 */
goog.i18n.bidi.Dir = {
  RTL: -1,
  UNKNOWN: 0,
  LTR: 1
};


/**
 * Convert a directionality given in various formats to a goog.i18n.bidi.Dir
 * constant. Useful for interaction with different standards of directionality
 * representation.
 *
 * @param {goog.i18n.bidi.Dir|number|boolean} givenDir Directionality given in
 *     one of the following formats:
 *     1. A goog.i18n.bidi.Dir constant.
 *     2. A number (positive = LRT, negative = RTL, 0 = unknown).
 *     3. A boolean (true = RTL, false = LTR).
 * @return {goog.i18n.bidi.Dir} A goog.i18n.bidi.Dir constant matching the given
 *     directionality.
 */
goog.i18n.bidi.toDir = function(givenDir) {
  if (typeof givenDir == 'number') {
    return givenDir > 0 ? goog.i18n.bidi.Dir.LTR :
        givenDir < 0 ? goog.i18n.bidi.Dir.RTL : goog.i18n.bidi.Dir.UNKNOWN;
  } else {
    return givenDir ? goog.i18n.bidi.Dir.RTL : goog.i18n.bidi.Dir.LTR;
  }
};


/**
 * Utility class for formatting text for display in a potentially
 * opposite-directionality context without garbling. Provides the following
 * functionality:
 *
 * @param {goog.i18n.bidi.Dir|number|boolean} dir The context
 *     directionality as a number
 *     (positive = LRT, negative = RTL, 0 = unknown).
 * @constructor
 */
goog.i18n.BidiFormatter = function(dir) {
  this.dir_ = goog.i18n.bidi.toDir(dir);
};


/**
 * Returns 'dir="ltr"' or 'dir="rtl"', depending on {@code text}'s estimated
 * directionality, if it is not the same as the context directionality.
 * Otherwise, returns the empty string.
 *
 * @param {string} text Text whose directionality is to be estimated.
 * @param {boolean=} opt_isHtml Whether {@code text} is HTML / HTML-escaped.
 *     Default: false.
 * @return {string} 'dir="rtl"' for RTL text in non-RTL context; 'dir="ltr"' for
 *     LTR text in non-LTR context; else, the empty string.
 */
goog.i18n.BidiFormatter.prototype.dirAttr = function (text, opt_isHtml) {
  var dir = soy.$$bidiTextDir(text, opt_isHtml);
  return dir && dir != this.dir_ ? dir < 0 ? 'dir="rtl"' : 'dir="ltr"' : '';
};

/**
 * Returns the trailing horizontal edge, i.e. "right" or "left", depending on
 * the global bidi directionality.
 * @return {string} "left" for RTL context and "right" otherwise.
 */
goog.i18n.BidiFormatter.prototype.endEdge = function () {
  return this.dir_ < 0 ? 'left' : 'right';
};

/**
 * Returns the Unicode BiDi mark matching the context directionality (LRM for
 * LTR context directionality, RLM for RTL context directionality), or the
 * empty string for neutral / unknown context directionality.
 *
 * @return {string} LRM for LTR context directionality and RLM for RTL context
 *     directionality.
 */
goog.i18n.BidiFormatter.prototype.mark = function () {
  return (
      (this.dir_ > 0) ? '\u200E' /*LRM*/ :
      (this.dir_ < 0) ? '\u200F' /*RLM*/ :
      '');
};

/**
 * Returns a Unicode BiDi mark matching the context directionality (LRM or RLM)
 * if the directionality or the exit directionality of {@code text} are opposite
 * to the context directionality. Otherwise returns the empty string.
 *
 * @param {string} text The input text.
 * @param {boolean=} opt_isHtml Whether {@code text} is HTML / HTML-escaped.
 *     Default: false.
 * @return {string} A Unicode bidi mark matching the global directionality or
 *     the empty string.
 */
goog.i18n.BidiFormatter.prototype.markAfter = function (text, opt_isHtml) {
  var dir = soy.$$bidiTextDir(text, opt_isHtml);
  return soyshim.$$bidiMarkAfterKnownDir_(this.dir_, dir, text, opt_isHtml);
};

/**
 * Formats a string of unknown directionality for use in HTML output of the
 * context directionality, so an opposite-directionality string is neither
 * garbled nor garbles what follows it.
 *
 * @param {string} str The input text.
 * @param {boolean=} placeholder This argument exists for consistency with the
 *     Closure Library. Specifying it has no effect.
 * @return {string} Input text after applying the above processing.
 */
goog.i18n.BidiFormatter.prototype.spanWrap = function(str, placeholder) {
  str = String(str);
  var textDir = soy.$$bidiTextDir(str, true);
  var reset = soyshim.$$bidiMarkAfterKnownDir_(this.dir_, textDir, str, true);
  if (textDir > 0 && this.dir_ <= 0) {
    str = '<span dir="ltr">' + str + '</span>';
  } else if (textDir < 0 && this.dir_ >= 0) {
    str = '<span dir="rtl">' + str + '</span>';
  }
  return str + reset;
};

/**
 * Returns the leading horizontal edge, i.e. "left" or "right", depending on
 * the global bidi directionality.
 * @return {string} "right" for RTL context and "left" otherwise.
 */
goog.i18n.BidiFormatter.prototype.startEdge = function () {
  return this.dir_ < 0 ? 'right' : 'left';
};

/**
 * Formats a string of unknown directionality for use in plain-text output of
 * the context directionality, so an opposite-directionality string is neither
 * garbled nor garbles what follows it.
 * As opposed to {@link #spanWrap}, this makes use of unicode BiDi formatting
 * characters. In HTML, its *only* valid use is inside of elements that do not
 * allow mark-up, e.g. an 'option' tag.
 *
 * @param {string} str The input text.
 * @param {boolean=} placeholder This argument exists for consistency with the
 *     Closure Library. Specifying it has no effect.
 * @return {string} Input text after applying the above processing.
 */
goog.i18n.BidiFormatter.prototype.unicodeWrap = function(str, placeholder) {
  str = String(str);
  var textDir = soy.$$bidiTextDir(str, true);
  var reset = soyshim.$$bidiMarkAfterKnownDir_(this.dir_, textDir, str, true);
  if (textDir > 0 && this.dir_ <= 0) {
    str = '\u202A' + str + '\u202C';
  } else if (textDir < 0 && this.dir_ >= 0) {
    str = '\u202B' + str + '\u202C';
  }
  return str + reset;
};


goog.string = {

  /**
   * Converts \r\n, \r, and \n to <br>s
   * @param {*} str The string in which to convert newlines.
   * @param {boolean=} opt_xml Whether to use XML compatible tags.
   * @return {string} A copy of {@code str} with converted newlines.
   */
  newLineToBr: function(str, opt_xml) {

    str = String(str);

    // This quick test helps in the case when there are no chars to replace,
    // in the worst case this makes barely a difference to the time taken.
    if (!goog.string.NEWLINE_TO_BR_RE_.test(str)) {
      return str;
    }

    return str.replace(/(\r\n|\r|\n)/g, opt_xml ? '<br />' : '<br>');
  },
  urlEncode: encodeURIComponent,
  /**
   * Regular expression used within newlineToBr().
   * @type {RegExp}
   * @private
   */
  NEWLINE_TO_BR_RE_: /[\r\n]/
};


/**
 * Utility class to facilitate much faster string concatenation in IE,
 * using Array.join() rather than the '+' operator. For other browsers
 * we simply use the '+' operator.
 *
 * @param {Object|number|string|boolean=} opt_a1 Optional first initial item
 *     to append.
 * @param {...Object|number|string|boolean} var_args Other initial items to
 *     append, e.g., new goog.string.StringBuffer('foo', 'bar').
 * @constructor
 */
goog.string.StringBuffer = function(opt_a1, var_args) {
  /**
   * Internal buffer for the string to be concatenated.
   * @type {string|Array}
   * @private
   */
  this.buffer_ = goog.userAgent.jscript.HAS_JSCRIPT ? [] : '';

  if (opt_a1 != null) {
    this.append.apply(this, arguments);
  }
};


/**
 * Length of internal buffer (faster than calling buffer_.length).
 * Only used for IE.
 * @type {number}
 * @private
 */
goog.string.StringBuffer.prototype.bufferLength_ = 0;

/**
 * Appends one or more items to the string.
 *
 * Calling this with null, undefined, or empty arguments is an error.
 *
 * @param {Object|number|string|boolean} a1 Required first string.
 * @param {Object|number|string|boolean=} opt_a2 Optional second string.
 * @param {...Object|number|string|boolean} var_args Other items to append,
 *     e.g., sb.append('foo', 'bar', 'baz').
 * @return {goog.string.StringBuffer} This same StringBuilder object.
 */
goog.string.StringBuffer.prototype.append = function(a1, opt_a2, var_args) {

  if (goog.userAgent.jscript.HAS_JSCRIPT) {
    if (opt_a2 == null) {  // no second argument (note: undefined == null)
      // Array assignment is 2x faster than Array push. Also, use a1
      // directly to avoid arguments instantiation, another 2x improvement.
      this.buffer_[this.bufferLength_++] = a1;
    } else {
      var arr = /**@type {Array.<number|string|boolean>}*/(this.buffer_);
      arr.push.apply(arr, arguments);
      this.bufferLength_ = this.buffer_.length;
    }

  } else {

    // Use a1 directly to avoid arguments instantiation for single-arg case.
    this.buffer_ += a1;
    if (opt_a2 != null) {  // no second argument (note: undefined == null)
      for (var i = 1; i < arguments.length; i++) {
        this.buffer_ += arguments[i];
      }
    }
  }

  return this;
};


/**
 * Clears the string.
 */
goog.string.StringBuffer.prototype.clear = function() {

  if (goog.userAgent.jscript.HAS_JSCRIPT) {
     this.buffer_.length = 0;  // reuse array to avoid creating new object
     this.bufferLength_ = 0;

   } else {
     this.buffer_ = '';
   }
};


/**
 * Returns the concatenated string.
 *
 * @return {string} The concatenated string.
 */
goog.string.StringBuffer.prototype.toString = function() {

  if (goog.userAgent.jscript.HAS_JSCRIPT) {
    var str = this.buffer_.join('');
    // Given a string with the entire contents, simplify the StringBuilder by
    // setting its contents to only be this string, rather than many fragments.
    this.clear();
    if (str) {
      this.append(str);
    }
    return str;

  } else {
    return /** @type {string} */ (this.buffer_);
  }
};


if (!goog.soy) goog.soy = {
  /**
   * Helper function to render a Soy template and then set the
   * output string as the innerHTML of an element. It is recommended
   * to use this helper function instead of directly setting
   * innerHTML in your hand-written code, so that it will be easier
   * to audit the code for cross-site scripting vulnerabilities.
   *
   * @param {Function} template The Soy template defining element's content.
   * @param {Object=} opt_templateData The data for the template.
   * @param {Object=} opt_injectedData The injected data for the template.
   * @param {(goog.dom.DomHelper|Document)=} opt_dom The context in which DOM
   *     nodes will be created.
   */
  renderAsElement: function(
    template, opt_templateData, opt_injectedData, opt_dom) {
    return /** @type {!Element} */ (soyshim.$$renderWithWrapper_(
        template, opt_templateData, opt_dom, true /* asElement */,
        opt_injectedData));
  },
  /**
   * Helper function to render a Soy template into a single node or
   * a document fragment. If the rendered HTML string represents a
   * single node, then that node is returned (note that this is
   * *not* a fragment, despite them name of the method). Otherwise a
   * document fragment is returned containing the rendered nodes.
   *
   * @param {Function} template The Soy template defining element's content.
   * @param {Object=} opt_templateData The data for the template.
   * @param {Object=} opt_injectedData The injected data for the template.
   * @param {(goog.dom.DomHelper|Document)=} opt_dom The context in which DOM
   *     nodes will be created.
   * @return {!Node} The resulting node or document fragment.
   */
  renderAsFragment: function(
    template, opt_templateData, opt_injectedData, opt_dom) {
    return soyshim.$$renderWithWrapper_(
        template, opt_templateData, opt_dom, false /* asElement */,
        opt_injectedData);
  },
  /**
   * Helper function to render a Soy template and then set the output string as
   * the innerHTML of an element. It is recommended to use this helper function
   * instead of directly setting innerHTML in your hand-written code, so that it
   * will be easier to audit the code for cross-site scripting vulnerabilities.
   *
   * NOTE: New code should consider using goog.soy.renderElement instead.
   *
   * @param {Element} element The element whose content we are rendering.
   * @param {Function} template The Soy template defining the element's content.
   * @param {Object=} opt_templateData The data for the template.
   * @param {Object=} opt_injectedData The injected data for the template.
   */
  renderElement: function(
      element, template, opt_templateData, opt_injectedData) {
    element.innerHTML = template(opt_templateData, null, opt_injectedData);
  },
  data: {}
};


/**
 * A type of textual content.
 *
 * This is an enum of type Object so that these values are unforgeable.
 *
 * @enum {!Object}
 */
goog.soy.data.SanitizedContentKind = {

  /**
   * A snippet of HTML that does not start or end inside a tag, comment, entity,
   * or DOCTYPE; and that does not contain any executable code
   * (JS, {@code <object>}s, etc.) from a different trust domain.
   */
  HTML: {},

  /**
   * Executable Javascript code or expression, safe for insertion in a
   * script-tag or event handler context, known to be free of any
   * attacker-controlled scripts. This can either be side-effect-free
   * Javascript (such as JSON) or Javascript that entirely under Google's
   * control.
   */
  JS: goog.DEBUG ? {sanitizedContentJsStrChars: true} : {},

  /**
   * A sequence of code units that can appear between quotes (either kind) in a
   * JS program without causing a parse error, and without causing any side
   * effects.
   * <p>
   * The content should not contain unescaped quotes, newlines, or anything else
   * that would cause parsing to fail or to cause a JS parser to finish the
   * string its parsing inside the content.
   * <p>
   * The content must also not end inside an escape sequence ; no partial octal
   * escape sequences or odd number of '{@code \}'s at the end.
   */
  JS_STR_CHARS: {},

  /** A properly encoded portion of a URI. */
  URI: {},

  /**
   * Repeated attribute names and values. For example,
   * {@code dir="ltr" foo="bar" onclick="trustedFunction()" checked}.
   */
  ATTRIBUTES: goog.DEBUG ? {sanitizedContentHtmlAttribute: true} : {},

  // TODO: Consider separating rules, declarations, and values into
  // separate types, but for simplicity, we'll treat explicitly blessed
  // SanitizedContent as allowed in all of these contexts.
  /**
   * A CSS3 declaration, property, value or group of semicolon separated
   * declarations.
   */
  CSS: {},

  /**
   * Unsanitized plain-text content.
   *
   * This is effectively the "null" entry of this enum, and is sometimes used
   * to explicitly mark content that should never be used unescaped. Since any
   * string is safe to use as text, being of ContentKind.TEXT makes no
   * guarantees about its safety in any other context such as HTML.
   */
  TEXT: {}
};



/**
 * A string-like object that carries a content-type.
 *
 * IMPORTANT! Do not create these directly, nor instantiate the subclasses.
 * Instead, use a trusted, centrally reviewed library as endorsed by your team
 * to generate these objects. Otherwise, you risk accidentally creating
 * SanitizedContent that is attacker-controlled and gets evaluated unescaped in
 * templates.
 *
 * @constructor
 */
goog.soy.data.SanitizedContent = function() {
  throw Error('Do not instantiate directly');
};


/**
 * The context in which this content is safe from XSS attacks.
 * @type {goog.soy.data.SanitizedContentKind}
 */
goog.soy.data.SanitizedContent.prototype.contentKind;


/**
 * The already-safe content.
 * @type {string}
 */
goog.soy.data.SanitizedContent.prototype.content;


/** @override */
goog.soy.data.SanitizedContent.prototype.toString = function() {
  return this.content;
};


var soy = { esc: {} };
var soydata = {};
soydata.VERY_UNSAFE = {};
var soyshim = { $$DEFAULT_TEMPLATE_DATA_: {} };
/**
 * Helper function to render a Soy template into a single node or a document
 * fragment. If the rendered HTML string represents a single node, then that
 * node is returned. Otherwise a document fragment is created and returned
 * (wrapped in a DIV element if #opt_singleNode is true).
 *
 * @param {Function} template The Soy template defining the element's content.
 * @param {Object=} opt_templateData The data for the template.
 * @param {(goog.dom.DomHelper|Document)=} opt_dom The context in which DOM
 *     nodes will be created.
 * @param {boolean=} opt_asElement Whether to wrap the fragment in an
 *     element if the template does not render a single element. If true,
 *     result is always an Element.
 * @param {Object=} opt_injectedData The injected data for the template.
 * @return {!Node} The resulting node or document fragment.
 * @private
 */
soyshim.$$renderWithWrapper_ = function(
    template, opt_templateData, opt_dom, opt_asElement, opt_injectedData) {

  var dom = opt_dom || document;
  var wrapper = dom.createElement('div');
  wrapper.innerHTML = template(
    opt_templateData || soyshim.$$DEFAULT_TEMPLATE_DATA_, undefined,
    opt_injectedData);

  // If the template renders as a single element, return it.
  if (wrapper.childNodes.length == 1) {
    var firstChild = wrapper.firstChild;
    if (!opt_asElement || firstChild.nodeType == 1 /* Element */) {
      return /** @type {!Node} */ (firstChild);
    }
  }

  // If we're forcing it to be a single element, return the wrapper DIV.
  if (opt_asElement) {
    return wrapper;
  }

  // Otherwise, create and return a fragment.
  var fragment = dom.createDocumentFragment();
  while (wrapper.firstChild) {
    fragment.appendChild(wrapper.firstChild);
  }
  return fragment;
};


/**
 * Returns a Unicode BiDi mark matching bidiGlobalDir (LRM or RLM) if the
 * directionality or the exit directionality of text are opposite to
 * bidiGlobalDir. Otherwise returns the empty string.
 * If opt_isHtml, makes sure to ignore the LTR nature of the mark-up and escapes
 * in text, making the logic suitable for HTML and HTML-escaped text.
 * @param {number} bidiGlobalDir The global directionality context: 1 if ltr, -1
 *     if rtl, 0 if unknown.
 * @param {number} dir text's directionality: 1 if ltr, -1 if rtl, 0 if unknown.
 * @param {string} text The text whose directionality is to be estimated.
 * @param {boolean=} opt_isHtml Whether text is HTML/HTML-escaped.
 *     Default: false.
 * @return {string} A Unicode bidi mark matching bidiGlobalDir, or
 *     the empty string when text's overall and exit directionalities both match
 *     bidiGlobalDir, or bidiGlobalDir is 0 (unknown).
 * @private
 */
soyshim.$$bidiMarkAfterKnownDir_ = function(
    bidiGlobalDir, dir, text, opt_isHtml) {
  return (
      bidiGlobalDir > 0 && (dir < 0 ||
          soyshim.$$bidiIsRtlExitText_(text, opt_isHtml)) ? '\u200E' : // LRM
      bidiGlobalDir < 0 && (dir > 0 ||
          soyshim.$$bidiIsLtrExitText_(text, opt_isHtml)) ? '\u200F' : // RLM
      '');
};


/**
 * Strips str of any HTML mark-up and escapes. Imprecise in several ways, but
 * precision is not very important, since the result is only meant to be used
 * for directionality detection.
 * @param {string} str The string to be stripped.
 * @param {boolean=} opt_isHtml Whether str is HTML / HTML-escaped.
 *     Default: false.
 * @return {string} The stripped string.
 * @private
 */
soyshim.$$bidiStripHtmlIfNecessary_ = function(str, opt_isHtml) {
  return opt_isHtml ? str.replace(soyshim.$$BIDI_HTML_SKIP_RE_, ' ') : str;
};


/**
 * Simplified regular expression for am HTML tag (opening or closing) or an HTML
 * escape - the things we want to skip over in order to ignore their ltr
 * characters.
 * @type {RegExp}
 * @private
 */
soyshim.$$BIDI_HTML_SKIP_RE_ = /<[^>]*>|&[^;]+;/g;


/**
 * A practical pattern to identify strong LTR character. This pattern is not
 * theoretically correct according to unicode standard. It is simplified for
 * performance and small code size.
 * @type {string}
 * @private
 */
soyshim.$$bidiLtrChars_ =
    'A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF' +
    '\u2C00-\uFB1C\uFDFE-\uFE6F\uFEFD-\uFFFF';


/**
 * A practical pattern to identify strong neutral and weak character. This
 * pattern is not theoretically correct according to unicode standard. It is
 * simplified for performance and small code size.
 * @type {string}
 * @private
 */
soyshim.$$bidiNeutralChars_ =
    '\u0000-\u0020!-@[-`{-\u00BF\u00D7\u00F7\u02B9-\u02FF\u2000-\u2BFF';


/**
 * A practical pattern to identify strong RTL character. This pattern is not
 * theoretically correct according to unicode standard. It is simplified for
 * performance and small code size.
 * @type {string}
 * @private
 */
soyshim.$$bidiRtlChars_ = '\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC';


/**
 * Regular expressions to check if a piece of text is of RTL directionality
 * on first character with strong directionality.
 * @type {RegExp}
 * @private
 */
soyshim.$$bidiRtlDirCheckRe_ = new RegExp(
    '^[^' + soyshim.$$bidiLtrChars_ + ']*[' + soyshim.$$bidiRtlChars_ + ']');


/**
 * Regular expressions to check if a piece of text is of neutral directionality.
 * Url are considered as neutral.
 * @type {RegExp}
 * @private
 */
soyshim.$$bidiNeutralDirCheckRe_ = new RegExp(
    '^[' + soyshim.$$bidiNeutralChars_ + ']*$|^http://');


/**
 * Check the directionality of the a piece of text based on the first character
 * with strong directionality.
 * @param {string} str string being checked.
 * @return {boolean} return true if rtl directionality is being detected.
 * @private
 */
soyshim.$$bidiIsRtlText_ = function(str) {
  return soyshim.$$bidiRtlDirCheckRe_.test(str);
};


/**
 * Check the directionality of the a piece of text based on the first character
 * with strong directionality.
 * @param {string} str string being checked.
 * @return {boolean} true if all characters have neutral directionality.
 * @private
 */
soyshim.$$bidiIsNeutralText_ = function(str) {
  return soyshim.$$bidiNeutralDirCheckRe_.test(str);
};


/**
 * This constant controls threshold of rtl directionality.
 * @type {number}
 * @private
 */
soyshim.$$bidiRtlDetectionThreshold_ = 0.40;


/**
 * Returns the RTL ratio based on word count.
 * @param {string} str the string that need to be checked.
 * @return {number} the ratio of RTL words among all words with directionality.
 * @private
 */
soyshim.$$bidiRtlWordRatio_ = function(str) {
  var rtlCount = 0;
  var totalCount = 0;
  var tokens = str.split(' ');
  for (var i = 0; i < tokens.length; i++) {
    if (soyshim.$$bidiIsRtlText_(tokens[i])) {
      rtlCount++;
      totalCount++;
    } else if (!soyshim.$$bidiIsNeutralText_(tokens[i])) {
      totalCount++;
    }
  }

  return totalCount == 0 ? 0 : rtlCount / totalCount;
};


/**
 * Regular expressions to check if the last strongly-directional character in a
 * piece of text is LTR.
 * @type {RegExp}
 * @private
 */
soyshim.$$bidiLtrExitDirCheckRe_ = new RegExp(
    '[' + soyshim.$$bidiLtrChars_ + '][^' + soyshim.$$bidiRtlChars_ + ']*$');


/**
 * Regular expressions to check if the last strongly-directional character in a
 * piece of text is RTL.
 * @type {RegExp}
 * @private
 */
soyshim.$$bidiRtlExitDirCheckRe_ = new RegExp(
    '[' + soyshim.$$bidiRtlChars_ + '][^' + soyshim.$$bidiLtrChars_ + ']*$');


/**
 * Check if the exit directionality a piece of text is LTR, i.e. if the last
 * strongly-directional character in the string is LTR.
 * @param {string} str string being checked.
 * @param {boolean=} opt_isHtml Whether str is HTML / HTML-escaped.
 *     Default: false.
 * @return {boolean} Whether LTR exit directionality was detected.
 * @private
 */
soyshim.$$bidiIsLtrExitText_ = function(str, opt_isHtml) {
  str = soyshim.$$bidiStripHtmlIfNecessary_(str, opt_isHtml);
  return soyshim.$$bidiLtrExitDirCheckRe_.test(str);
};


/**
 * Check if the exit directionality a piece of text is RTL, i.e. if the last
 * strongly-directional character in the string is RTL.
 * @param {string} str string being checked.
 * @param {boolean=} opt_isHtml Whether str is HTML / HTML-escaped.
 *     Default: false.
 * @return {boolean} Whether RTL exit directionality was detected.
 * @private
 */
soyshim.$$bidiIsRtlExitText_ = function(str, opt_isHtml) {
  str = soyshim.$$bidiStripHtmlIfNecessary_(str, opt_isHtml);
  return soyshim.$$bidiRtlExitDirCheckRe_.test(str);
};


// =============================================================================
// COPIED FROM soyutils_usegoog.js


// -----------------------------------------------------------------------------
// StringBuilder (compatible with the 'stringbuilder' code style).


/**
 * Utility class to facilitate much faster string concatenation in IE,
 * using Array.join() rather than the '+' operator. For other browsers
 * we simply use the '+' operator.
 *
 * @param {Object} var_args Initial items to append,
 *     e.g., new soy.StringBuilder('foo', 'bar').
 * @constructor
 */
soy.StringBuilder = goog.string.StringBuffer;


// -----------------------------------------------------------------------------
// soydata: Defines typed strings, e.g. an HTML string {@code "a<b>c"} is
// semantically distinct from the plain text string {@code "a<b>c"} and smart
// templates can take that distinction into account.

/**
 * A type of textual content.
 *
 * This is an enum of type Object so that these values are unforgeable.
 *
 * @enum {!Object}
 */
soydata.SanitizedContentKind = goog.soy.data.SanitizedContentKind;


/**
 * Content of type {@link soydata.SanitizedContentKind.HTML}.
 *
 * The content is a string of HTML that can safely be embedded in a PCDATA
 * context in your app.  If you would be surprised to find that an HTML
 * sanitizer produced {@code s} (e.g.  it runs code or fetches bad URLs) and
 * you wouldn't write a template that produces {@code s} on security or privacy
 * grounds, then don't pass {@code s} here.
 *
 * @constructor
 * @extends {goog.soy.data.SanitizedContent}
 */
soydata.SanitizedHtml = function() {
  goog.soy.data.SanitizedContent.call(this);  // Throws an exception.
};
goog.inherits(soydata.SanitizedHtml, goog.soy.data.SanitizedContent);

/** @override */
soydata.SanitizedHtml.prototype.contentKind = soydata.SanitizedContentKind.HTML;


/**
 * Content of type {@link soydata.SanitizedContentKind.JS}.
 *
 * The content is Javascript source that when evaluated does not execute any
 * attacker-controlled scripts.
 *
 * @constructor
 * @extends {goog.soy.data.SanitizedContent}
 */
soydata.SanitizedJs = function() {
  goog.soy.data.SanitizedContent.call(this);  // Throws an exception.
};
goog.inherits(soydata.SanitizedJs, goog.soy.data.SanitizedContent);

/** @override */
soydata.SanitizedJs.prototype.contentKind =
    soydata.SanitizedContentKind.JS;


/**
 * Content of type {@link soydata.SanitizedContentKind.JS_STR_CHARS}.
 *
 * The content can be safely inserted as part of a single- or double-quoted
 * string without terminating the string.
 *
 * @constructor
 * @extends {goog.soy.data.SanitizedContent}
 */
soydata.SanitizedJsStrChars = function() {
  goog.soy.data.SanitizedContent.call(this);  // Throws an exception.
};
goog.inherits(soydata.SanitizedJsStrChars, goog.soy.data.SanitizedContent);

/** @override */
soydata.SanitizedJsStrChars.prototype.contentKind =
    soydata.SanitizedContentKind.JS_STR_CHARS;


/**
 * Content of type {@link soydata.SanitizedContentKind.URI}.
 *
 * The content is a URI chunk that the caller knows is safe to emit in a
 * template.
 *
 * @constructor
 * @extends {goog.soy.data.SanitizedContent}
 */
soydata.SanitizedUri = function() {
  goog.soy.data.SanitizedContent.call(this);  // Throws an exception.
};
goog.inherits(soydata.SanitizedUri, goog.soy.data.SanitizedContent);

/** @override */
soydata.SanitizedUri.prototype.contentKind = soydata.SanitizedContentKind.URI;


/**
 * Content of type {@link soydata.SanitizedContentKind.ATTRIBUTES}.
 *
 * The content should be safely embeddable within an open tag, such as a
 * key="value" pair.
 *
 * @constructor
 * @extends {goog.soy.data.SanitizedContent}
 */
soydata.SanitizedHtmlAttribute = function() {
  goog.soy.data.SanitizedContent.call(this);  // Throws an exception.
};
goog.inherits(soydata.SanitizedHtmlAttribute, goog.soy.data.SanitizedContent);

/** @override */
soydata.SanitizedHtmlAttribute.prototype.contentKind =
    soydata.SanitizedContentKind.ATTRIBUTES;


/**
 * Content of type {@link soydata.SanitizedContentKind.CSS}.
 *
 * The content is non-attacker-exploitable CSS, such as {@code color:#c3d9ff}.
 *
 * @constructor
 * @extends {goog.soy.data.SanitizedContent}
 */
soydata.SanitizedCss = function() {
  goog.soy.data.SanitizedContent.call(this);  // Throws an exception.
};
goog.inherits(soydata.SanitizedCss, goog.soy.data.SanitizedContent);

/** @override */
soydata.SanitizedCss.prototype.contentKind =
    soydata.SanitizedContentKind.CSS;


/**
 * Unsanitized plain text string.
 *
 * While all strings are effectively safe to use as a plain text, there are no
 * guarantees about safety in any other context such as HTML. This is
 * sometimes used to mark that should never be used unescaped.
 *
 * @param {*} content Plain text with no guarantees.
 * @constructor
 * @extends {goog.soy.data.SanitizedContent}
 */
soydata.UnsanitizedText = function(content) {
  /** @override */
  this.content = String(content);
};
goog.inherits(soydata.UnsanitizedText, goog.soy.data.SanitizedContent);

/** @override */
soydata.UnsanitizedText.prototype.contentKind =
    soydata.SanitizedContentKind.TEXT;


/**
 * Creates a factory for SanitizedContent types.
 *
 * This is a hack so that the soydata.VERY_UNSAFE.ordainSanitized* can
 * instantiate Sanitized* classes, without making the Sanitized* constructors
 * publicly usable. Requiring all construction to use the VERY_UNSAFE names
 * helps callers and their reviewers easily tell that creating SanitizedContent
 * is not always safe and calls for careful review.
 *
 * @param {function(new: T, string)} ctor A constructor.
 * @return {!function(*): T} A factory that takes content and returns a
 *     new instance.
 * @template T
 * @private
 */
soydata.$$makeSanitizedContentFactory_ = function(ctor) {
  /** @constructor */
  function InstantiableCtor() {}
  InstantiableCtor.prototype = ctor.prototype;
  return function(content) {
    var result = new InstantiableCtor();
    result.content = String(content);
    return result;
  };
};


// -----------------------------------------------------------------------------
// Sanitized content ordainers. Please use these with extreme caution (with the
// exception of markUnsanitizedText). A good recommendation is to limit usage
// of these to just a handful of files in your source tree where usages can be
// carefully audited.


/**
 * Protects a string from being used in an noAutoescaped context.
 *
 * This is useful for content where there is significant risk of accidental
 * unescaped usage in a Soy template. A great case is for user-controlled
 * data that has historically been a source of vulernabilities.
 *
 * @param {*} content Text to protect.
 * @return {!soydata.UnsanitizedText} A wrapper that is rejected by the
 *     Soy noAutoescape print directive.
 */
soydata.markUnsanitizedText = function(content) {
  return new soydata.UnsanitizedText(content);
};


/**
 * Takes a leap of faith that the provided content is "safe" HTML.
 *
 * @param {*} content A string of HTML that can safely be embedded in
 *     a PCDATA context in your app. If you would be surprised to find that an
 *     HTML sanitizer produced {@code s} (e.g. it runs code or fetches bad URLs)
 *     and you wouldn't write a template that produces {@code s} on security or
 *     privacy grounds, then don't pass {@code s} here.
 * @return {!soydata.SanitizedHtml} Sanitized content wrapper that
 *     indicates to Soy not to escape when printed as HTML.
 */
soydata.VERY_UNSAFE.ordainSanitizedHtml =
    soydata.$$makeSanitizedContentFactory_(soydata.SanitizedHtml);


/**
 * Takes a leap of faith that the provided content is "safe" (non-attacker-
 * controlled, XSS-free) Javascript.
 *
 * @param {*} content Javascript source that when evaluated does not
 *     execute any attacker-controlled scripts.
 * @return {!soydata.SanitizedJs} Sanitized content wrapper that indicates to
 *     Soy not to escape when printed as Javascript source.
 */
soydata.VERY_UNSAFE.ordainSanitizedJs =
    soydata.$$makeSanitizedContentFactory_(soydata.SanitizedJs);


// TODO: This function is probably necessary, either externally or internally
// as an implementation detail. Generally, plain text will always work here,
// as there's no harm to unescaping the string and then re-escaping when
// finally printed.
/**
 * Takes a leap of faith that the provided content can be safely embedded in
 * a Javascript string without re-esacping.
 *
 * @param {*} content Content that can be safely inserted as part of a
 *     single- or double-quoted string without terminating the string.
 * @return {!soydata.SanitizedJsStrChars} Sanitized content wrapper that
 *     indicates to Soy not to escape when printed in a JS string.
 */
soydata.VERY_UNSAFE.ordainSanitizedJsStrChars =
    soydata.$$makeSanitizedContentFactory_(soydata.SanitizedJsStrChars);


/**
 * Takes a leap of faith that the provided content is "safe" to use as a URI
 * in a Soy template.
 *
 * This creates a Soy SanitizedContent object which indicates to Soy there is
 * no need to escape it when printed as a URI (e.g. in an href or src
 * attribute), such as if it's already been encoded or  if it's a Javascript:
 * URI.
 *
 * @param {*} content A chunk of URI that the caller knows is safe to
 *     emit in a template.
 * @return {!soydata.SanitizedUri} Sanitized content wrapper that indicates to
 *     Soy not to escape or filter when printed in URI context.
 */
soydata.VERY_UNSAFE.ordainSanitizedUri =
    soydata.$$makeSanitizedContentFactory_(soydata.SanitizedUri);


/**
 * Takes a leap of faith that the provided content is "safe" to use as an
 * HTML attribute.
 *
 * @param {*} content An attribute name and value, such as
 *     {@code dir="ltr"}.
 * @return {!soydata.SanitizedHtmlAttribute} Sanitized content wrapper that
 *     indicates to Soy not to escape when printed as an HTML attribute.
 */
soydata.VERY_UNSAFE.ordainSanitizedHtmlAttribute =
    soydata.$$makeSanitizedContentFactory_(soydata.SanitizedHtmlAttribute);


/**
 * Takes a leap of faith that the provided content is "safe" to use as CSS
 * in a style attribute or block.
 *
 * @param {*} content CSS, such as {@code color:#c3d9ff}.
 * @return {!soydata.SanitizedCss} Sanitized CSS wrapper that indicates to
 *     Soy there is no need to escape or filter when printed in CSS context.
 */
soydata.VERY_UNSAFE.ordainSanitizedCss =
    soydata.$$makeSanitizedContentFactory_(soydata.SanitizedCss);


// -----------------------------------------------------------------------------
// Public utilities.


/**
 * Helper function to render a Soy template and then set the output string as
 * the innerHTML of an element. It is recommended to use this helper function
 * instead of directly setting innerHTML in your hand-written code, so that it
 * will be easier to audit the code for cross-site scripting vulnerabilities.
 *
 * NOTE: New code should consider using goog.soy.renderElement instead.
 *
 * @param {Element} element The element whose content we are rendering.
 * @param {Function} template The Soy template defining the element's content.
 * @param {Object=} opt_templateData The data for the template.
 * @param {Object=} opt_injectedData The injected data for the template.
 */
soy.renderElement = goog.soy.renderElement;


/**
 * Helper function to render a Soy template into a single node or a document
 * fragment. If the rendered HTML string represents a single node, then that
 * node is returned (note that this is *not* a fragment, despite them name of
 * the method). Otherwise a document fragment is returned containing the
 * rendered nodes.
 *
 * NOTE: New code should consider using goog.soy.renderAsFragment
 * instead (note that the arguments are different).
 *
 * @param {Function} template The Soy template defining the element's content.
 * @param {Object=} opt_templateData The data for the template.
 * @param {Document=} opt_document The document used to create DOM nodes. If not
 *     specified, global document object is used.
 * @param {Object=} opt_injectedData The injected data for the template.
 * @return {!Node} The resulting node or document fragment.
 */
soy.renderAsFragment = function(
    template, opt_templateData, opt_document, opt_injectedData) {
  return goog.soy.renderAsFragment(
      template, opt_templateData, opt_injectedData,
      new goog.dom.DomHelper(opt_document));
};


/**
 * Helper function to render a Soy template into a single node. If the rendered
 * HTML string represents a single node, then that node is returned. Otherwise,
 * a DIV element is returned containing the rendered nodes.
 *
 * NOTE: New code should consider using goog.soy.renderAsElement
 * instead (note that the arguments are different).
 *
 * @param {Function} template The Soy template defining the element's content.
 * @param {Object=} opt_templateData The data for the template.
 * @param {Document=} opt_document The document used to create DOM nodes. If not
 *     specified, global document object is used.
 * @param {Object=} opt_injectedData The injected data for the template.
 * @return {!Element} Rendered template contents, wrapped in a parent DIV
 *     element if necessary.
 */
soy.renderAsElement = function(
    template, opt_templateData, opt_document, opt_injectedData) {
  return goog.soy.renderAsElement(
      template, opt_templateData, opt_injectedData,
      new goog.dom.DomHelper(opt_document));
};


// -----------------------------------------------------------------------------
// Below are private utilities to be used by Soy-generated code only.


/**
 * Builds an augmented map. The returned map will contain mappings from both
 * the base map and the additional map. If the same key appears in both, then
 * the value from the additional map will be visible, while the value from the
 * base map will be hidden. The base map will be used, but not modified.
 *
 * @param {!Object} baseMap The original map to augment.
 * @param {!Object} additionalMap A map containing the additional mappings.
 * @return {!Object} An augmented map containing both the original and
 *     additional mappings.
 */
soy.$$augmentMap = function(baseMap, additionalMap) {

  // Create a new map whose '__proto__' field is set to baseMap.
  /** @constructor */
  function TempCtor() {}
  TempCtor.prototype = baseMap;
  var augmentedMap = new TempCtor();

  // Add the additional mappings to the new map.
  for (var key in additionalMap) {
    augmentedMap[key] = additionalMap[key];
  }

  return augmentedMap;
};


/**
 * Checks that the given map key is a string.
 * @param {*} key Key to check.
 * @return {string} The given key.
 */
soy.$$checkMapKey = function(key) {
  if ((typeof key) != 'string') {
    throw Error(
        'Map literal\'s key expression must evaluate to string' +
        ' (encountered type "' + (typeof key) + '").');
  }
  return key;
};


/**
 * Gets the keys in a map as an array. There are no guarantees on the order.
 * @param {Object} map The map to get the keys of.
 * @return {Array.<string>} The array of keys in the given map.
 */
soy.$$getMapKeys = function(map) {
  var mapKeys = [];
  for (var key in map) {
    mapKeys.push(key);
  }
  return mapKeys;
};


/**
 * Gets a consistent unique id for the given delegate template name. Two calls
 * to this function will return the same id if and only if the input names are
 * the same.
 *
 * <p> Important: This function must always be called with a string constant.
 *
 * <p> If Closure Compiler is not being used, then this is just this identity
 * function. If Closure Compiler is being used, then each call to this function
 * will be replaced with a short string constant, which will be consistent per
 * input name.
 *
 * @param {string} delTemplateName The delegate template name for which to get a
 *     consistent unique id.
 * @return {string} A unique id that is consistent per input name.
 *
 * @consistentIdGenerator
 */
soy.$$getDelTemplateId = function(delTemplateName) {
  return delTemplateName;
};


/**
 * Map from registered delegate template key to the priority of the
 * implementation.
 * @type {Object}
 * @private
 */
soy.$$DELEGATE_REGISTRY_PRIORITIES_ = {};

/**
 * Map from registered delegate template key to the implementation function.
 * @type {Object}
 * @private
 */
soy.$$DELEGATE_REGISTRY_FUNCTIONS_ = {};


/**
 * Registers a delegate implementation. If the same delegate template key (id
 * and variant) has been registered previously, then priority values are
 * compared and only the higher priority implementation is stored (if
 * priorities are equal, an error is thrown).
 *
 * @param {string} delTemplateId The delegate template id.
 * @param {string} delTemplateVariant The delegate template variant (can be
 *     empty string).
 * @param {number} delPriority The implementation's priority value.
 * @param {Function} delFn The implementation function.
 */
soy.$$registerDelegateFn = function(
    delTemplateId, delTemplateVariant, delPriority, delFn) {

  var mapKey = 'key_' + delTemplateId + ':' + delTemplateVariant;
  var currPriority = soy.$$DELEGATE_REGISTRY_PRIORITIES_[mapKey];
  if (currPriority === undefined || delPriority > currPriority) {
    // Registering new or higher-priority function: replace registry entry.
    soy.$$DELEGATE_REGISTRY_PRIORITIES_[mapKey] = delPriority;
    soy.$$DELEGATE_REGISTRY_FUNCTIONS_[mapKey] = delFn;
  } else if (delPriority == currPriority) {
    // Registering same-priority function: error.
    throw Error(
        'Encountered two active delegates with the same priority ("' +
            delTemplateId + ':' + delTemplateVariant + '").');
  } else {
    // Registering lower-priority function: do nothing.
  }
};


/**
 * Retrieves the (highest-priority) implementation that has been registered for
 * a given delegate template key (id and variant). If no implementation has
 * been registered for the key, then the fallback is the same id with empty
 * variant. If the fallback is also not registered, and allowsEmptyDefault is
 * true, then returns an implementation that is equivalent to an empty template
 * (i.e. rendered output would be empty string).
 *
 * @param {string} delTemplateId The delegate template id.
 * @param {string} delTemplateVariant The delegate template variant (can be
 *     empty string).
 * @param {boolean} allowsEmptyDefault Whether to default to the empty template
 *     function if there's no active implementation.
 * @return {Function} The retrieved implementation function.
 */
soy.$$getDelegateFn = function(
    delTemplateId, delTemplateVariant, allowsEmptyDefault) {

  var delFn = soy.$$DELEGATE_REGISTRY_FUNCTIONS_[
      'key_' + delTemplateId + ':' + delTemplateVariant];
  if (! delFn && delTemplateVariant != '') {
    // Fallback to empty variant.
    delFn = soy.$$DELEGATE_REGISTRY_FUNCTIONS_['key_' + delTemplateId + ':'];
  }

  if (delFn) {
    return delFn;
  } else if (allowsEmptyDefault) {
    return soy.$$EMPTY_TEMPLATE_FN_;
  } else {
    throw Error(
        'Found no active impl for delegate call to "' + delTemplateId + ':' +
            delTemplateVariant + '" (and not allowemptydefault="true").');
  }
};


/**
 * Private helper soy.$$getDelegateFn(). This is the empty template function
 * that is returned whenever there's no delegate implementation found.
 *
 * @param {Object.<string, *>=} opt_data
 * @param {soy.StringBuilder=} opt_sb
 * @param {Object.<string, *>=} opt_ijData
 * @return {string}
 * @private
 */
soy.$$EMPTY_TEMPLATE_FN_ = function(opt_data, opt_sb, opt_ijData) {
  return '';
};


// -----------------------------------------------------------------------------
// Escape/filter/normalize.


/**
 * Escapes HTML special characters in a string. Escapes double quote '"' in
 * addition to '&', '<', and '>' so that a string can be included in an HTML
 * tag attribute value within double quotes.
 * Will emit known safe HTML as-is.
 *
 * @param {*} value The string-like value to be escaped. May not be a string,
 *     but the value will be coerced to a string.
 * @return {string} An escaped version of value.
 */
soy.$$escapeHtml = function(value) {
  // TODO: Perhaps we should just ignore the contentKind property and instead
  // look only at the constructor.
  if (value && value.contentKind &&
      value.contentKind === goog.soy.data.SanitizedContentKind.HTML) {
    goog.asserts.assert(
        value.constructor === soydata.SanitizedHtml);
    return value.content;
  }
  return soy.esc.$$escapeHtmlHelper(value);
};


/**
 * Strips unsafe tags to convert a string of untrusted HTML into HTML that
 * is safe to embed.
 *
 * @param {*} value The string-like value to be escaped. May not be a string,
 *     but the value will be coerced to a string.
 * @return {string} A sanitized and normalized version of value.
 */
soy.$$cleanHtml = function(value) {
  if (value && value.contentKind &&
      value.contentKind === goog.soy.data.SanitizedContentKind.HTML) {
    goog.asserts.assert(
        value.constructor === soydata.SanitizedHtml);
    return value.content;
  }
  return soy.$$stripHtmlTags(value, soy.esc.$$SAFE_TAG_WHITELIST_);
};


/**
 * Escapes HTML special characters in a string so that it can be embedded in
 * RCDATA.
 * <p>
 * Escapes HTML special characters so that the value will not prematurely end
 * the body of a tag like {@code <textarea>} or {@code <title>}. RCDATA tags
 * cannot contain other HTML entities, so it is not strictly necessary to escape
 * HTML special characters except when part of that text looks like an HTML
 * entity or like a close tag : {@code </textarea>}.
 * <p>
 * Will normalize known safe HTML to make sure that sanitized HTML (which could
 * contain an innocuous {@code </textarea>} don't prematurely end an RCDATA
 * element.
 *
 * @param {*} value The string-like value to be escaped. May not be a string,
 *     but the value will be coerced to a string.
 * @return {string} An escaped version of value.
 */
soy.$$escapeHtmlRcdata = function(value) {
  if (value && value.contentKind &&
      value.contentKind === goog.soy.data.SanitizedContentKind.HTML) {
    goog.asserts.assert(
        value.constructor === soydata.SanitizedHtml);
    return soy.esc.$$normalizeHtmlHelper(value.content);
  }
  return soy.esc.$$escapeHtmlHelper(value);
};


/**
 * Matches any/only HTML5 void elements' start tags.
 * See http://www.w3.org/TR/html-markup/syntax.html#syntax-elements
 * @type {RegExp}
 * @private
 */
soy.$$HTML5_VOID_ELEMENTS_ = new RegExp(
    '^<(?:area|base|br|col|command|embed|hr|img|input' +
    '|keygen|link|meta|param|source|track|wbr)\\b');


/**
 * Removes HTML tags from a string of known safe HTML.
 * If opt_tagWhitelist is not specified or is empty, then
 * the result can be used as an attribute value.
 *
 * @param {*} value The HTML to be escaped. May not be a string, but the
 *     value will be coerced to a string.
 * @param {Object.<string, number>=} opt_tagWhitelist Has an own property whose
 *     name is a lower-case tag name and whose value is {@code 1} for
 *     each element that is allowed in the output.
 * @return {string} A representation of value without disallowed tags,
 *     HTML comments, or other non-text content.
 */
soy.$$stripHtmlTags = function(value, opt_tagWhitelist) {
  if (!opt_tagWhitelist) {
    // If we have no white-list, then use a fast track which elides all tags.
    return String(value).replace(soy.esc.$$HTML_TAG_REGEX_, '')
        // This is just paranoia since callers should normalize the result
        // anyway, but if they didn't, it would be necessary to ensure that
        // after the first replace non-tag uses of < do not recombine into
        // tags as in "<<foo>script>alert(1337)</<foo>script>".
        .replace(soy.esc.$$LT_REGEX_, '&lt;');
  }

  // Escapes '[' so that we can use [123] below to mark places where tags
  // have been removed.
  var html = String(value).replace(/\[/g, '&#91;');

  // Consider all uses of '<' and replace whitelisted tags with markers like
  // [1] which are indices into a list of approved tag names.
  // Replace all other uses of < and > with entities.
  var tags = [];
  html = html.replace(
    soy.esc.$$HTML_TAG_REGEX_,
    function(tok, tagName) {
      if (tagName) {
        tagName = tagName.toLowerCase();
        if (opt_tagWhitelist.hasOwnProperty(tagName) &&
            opt_tagWhitelist[tagName]) {
          var start = tok.charAt(1) === '/' ? '</' : '<';
          var index = tags.length;
          tags[index] = start + tagName + '>';
          return '[' + index + ']';
        }
      }
      return '';
    });

  // Escape HTML special characters. Now there are no '<' in html that could
  // start a tag.
  html = soy.esc.$$normalizeHtmlHelper(html);

  var finalCloseTags = soy.$$balanceTags_(tags);

  // Now html contains no tags or less-than characters that could become
  // part of a tag via a replacement operation and tags only contains
  // approved tags.
  // Reinsert the white-listed tags.
  html = html.replace(
       /\[(\d+)\]/g, function(_, index) { return tags[index]; });

  // Close any still open tags.
  // This prevents unclosed formatting elements like <ol> and <table> from
  // breaking the layout of containing HTML.
  return html + finalCloseTags;
};


/**
 * Throw out any close tags that don't correspond to start tags.
 * If {@code <table>} is used for formatting, embedded HTML shouldn't be able
 * to use a mismatched {@code </table>} to break page layout.
 *
 * @param {Array.<string>} tags an array of tags that will be modified in place
 *    include tags, the empty string, or concatenations of empty tags.
 * @return {string} zero or more closed tags that close all elements that are
 *    opened in tags but not closed.
 * @private
 */
soy.$$balanceTags_ = function(tags) {
  var open = [];
  for (var i = 0, n = tags.length; i < n; ++i) {
    var tag = tags[i];
    if (tag.charAt(1) === '/') {
      var openTagIndex = open.length - 1;
      // NOTE: This is essentially lastIndexOf, but it's not supported in IE.
      while (openTagIndex >= 0 && open[openTagIndex] != tag) {
        openTagIndex--;
      }
      if (openTagIndex < 0) {
        tags[i] = '';  // Drop close tag.
      } else {
        tags[i] = open.slice(openTagIndex).reverse().join('');
        open.length = openTagIndex;
      }
    } else if (!soy.$$HTML5_VOID_ELEMENTS_.test(tag)) {
      open.push('</' + tag.substring(1));
    }
  }
  return open.reverse().join('');
};


/**
 * Escapes HTML special characters in an HTML attribute value.
 *
 * @param {*} value The HTML to be escaped. May not be a string, but the
 *     value will be coerced to a string.
 * @return {string} An escaped version of value.
 */
soy.$$escapeHtmlAttribute = function(value) {
  if (value && value.contentKind) {
    // NOTE: We don't accept ATTRIBUTES here because ATTRIBUTES is
    // actually not the attribute value context, but instead k/v pairs.
    if (value.contentKind === goog.soy.data.SanitizedContentKind.HTML) {
      // NOTE: After removing tags, we also escape quotes ("normalize") so that
      // the HTML can be embedded in attribute context.
      goog.asserts.assert(
          value.constructor === soydata.SanitizedHtml);
      return soy.esc.$$normalizeHtmlHelper(soy.$$stripHtmlTags(value.content));
    }
  }
  return soy.esc.$$escapeHtmlHelper(value);
};


/**
 * Escapes HTML special characters in a string including space and other
 * characters that can end an unquoted HTML attribute value.
 *
 * @param {*} value The HTML to be escaped. May not be a string, but the
 *     value will be coerced to a string.
 * @return {string} An escaped version of value.
 */
soy.$$escapeHtmlAttributeNospace = function(value) {
  if (value && value.contentKind) {
    if (value.contentKind === goog.soy.data.SanitizedContentKind.HTML) {
      goog.asserts.assert(value.constructor ===
          soydata.SanitizedHtml);
      return soy.esc.$$normalizeHtmlNospaceHelper(
          soy.$$stripHtmlTags(value.content));
    }
  }
  return soy.esc.$$escapeHtmlNospaceHelper(value);
};


/**
 * Filters out strings that cannot be a substring of a valid HTML attribute.
 *
 * Note the input is expected to be key=value pairs.
 *
 * @param {*} value The value to escape. May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} A valid HTML attribute name part or name/value pair.
 *     {@code "zSoyz"} if the input is invalid.
 */
soy.$$filterHtmlAttributes = function(value) {
  // NOTE: Explicitly no support for SanitizedContentKind.HTML, since that is
  // meaningless in this context, which is generally *between* html attributes.
  if (value &&
      value.contentKind === goog.soy.data.SanitizedContentKind.ATTRIBUTES) {
    goog.asserts.assert(value.constructor ===
        soydata.SanitizedHtmlAttribute);
    // Add a space at the end to ensure this won't get merged into following
    // attributes, unless the interpretation is unambiguous (ending with quotes
    // or a space).
    return value.content.replace(/([^"'\s])$/, '$1 ');
  }
  // TODO: Dynamically inserting attributes that aren't marked as trusted is
  // probably unnecessary.  Any filtering done here will either be inadequate
  // for security or not flexible enough.  Having clients use kind="attributes"
  // in parameters seems like a wiser idea.
  return soy.esc.$$filterHtmlAttributesHelper(value);
};


/**
 * Filters out strings that cannot be a substring of a valid HTML element name.
 *
 * @param {*} value The value to escape. May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} A valid HTML element name part.
 *     {@code "zSoyz"} if the input is invalid.
 */
soy.$$filterHtmlElementName = function(value) {
  // NOTE: We don't accept any SanitizedContent here. HTML indicates valid
  // PCDATA, not tag names. A sloppy developer shouldn't be able to cause an
  // exploit:
  // ... {let userInput}script src=http://evil.com/evil.js{/let} ...
  // ... {param tagName kind="html"}{$userInput}{/param} ...
  // ... <{$tagName}>Hello World</{$tagName}>
  return soy.esc.$$filterHtmlElementNameHelper(value);
};


/**
 * Escapes characters in the value to make it valid content for a JS string
 * literal.
 *
 * @param {*} value The value to escape. May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} An escaped version of value.
 * @deprecated
 */
soy.$$escapeJs = function(value) {
  return soy.$$escapeJsString(value);
};


/**
 * Escapes characters in the value to make it valid content for a JS string
 * literal.
 *
 * @param {*} value The value to escape. May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} An escaped version of value.
 */
soy.$$escapeJsString = function(value) {
  if (value &&
      value.contentKind === goog.soy.data.SanitizedContentKind.JS_STR_CHARS) {
    // TODO: It might still be worthwhile to normalize it to remove
    // unescaped quotes, null, etc: replace(/(?:^|[^\])['"]/g, '\\$
    goog.asserts.assert(value.constructor ===
        soydata.SanitizedJsStrChars);
    return value.content;
  }
  return soy.esc.$$escapeJsStringHelper(value);
};


/**
 * Encodes a value as a JavaScript literal.
 *
 * @param {*} value The value to escape. May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} A JavaScript code representation of the input.
 */
soy.$$escapeJsValue = function(value) {
  // We surround values with spaces so that they can't be interpolated into
  // identifiers by accident.
  // We could use parentheses but those might be interpreted as a function call.
  if (value == null) {  // Intentionally matches undefined.
    // Java returns null from maps where there is no corresponding key while
    // JS returns undefined.
    // We always output null for compatibility with Java which does not have a
    // distinct undefined value.
    return ' null ';
  }
  if (value.contentKind == goog.soy.data.SanitizedContentKind.JS) {
    goog.asserts.assert(value.constructor ===
        soydata.SanitizedJs);
    return value.content;
  }
  switch (typeof value) {
    case 'boolean': case 'number':
      return ' ' + value + ' ';
    default:
      return "'" + soy.esc.$$escapeJsStringHelper(String(value)) + "'";
  }
};


/**
 * Escapes characters in the string to make it valid content for a JS regular
 * expression literal.
 *
 * @param {*} value The value to escape. May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} An escaped version of value.
 */
soy.$$escapeJsRegex = function(value) {
  return soy.esc.$$escapeJsRegexHelper(value);
};


/**
 * Matches all URI mark characters that conflict with HTML attribute delimiters
 * or that cannot appear in a CSS uri.
 * From <a href="http://www.w3.org/TR/CSS2/grammar.html">G.2: CSS grammar</a>
 * <pre>
 *     url        ([!#$%&*-~]|{nonascii}|{escape})*
 * </pre>
 *
 * @type {RegExp}
 * @private
 */
soy.$$problematicUriMarks_ = /['()]/g;

/**
 * @param {string} ch A single character in {@link soy.$$problematicUriMarks_}.
 * @return {string}
 * @private
 */
soy.$$pctEncode_ = function(ch) {
  return '%' + ch.charCodeAt(0).toString(16);
};

/**
 * Escapes a string so that it can be safely included in a URI.
 *
 * @param {*} value The value to escape. May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} An escaped version of value.
 */
soy.$$escapeUri = function(value) {
  if (value && value.contentKind === goog.soy.data.SanitizedContentKind.URI) {
    goog.asserts.assert(value.constructor ===
        soydata.SanitizedUri);
    return soy.$$normalizeUri(value);
  }
  // Apostophes and parentheses are not matched by encodeURIComponent.
  // They are technically special in URIs, but only appear in the obsolete mark
  // production in Appendix D.2 of RFC 3986, so can be encoded without changing
  // semantics.
  var encoded = soy.esc.$$escapeUriHelper(value);
  soy.$$problematicUriMarks_.lastIndex = 0;
  if (soy.$$problematicUriMarks_.test(encoded)) {
    return encoded.replace(soy.$$problematicUriMarks_, soy.$$pctEncode_);
  }
  return encoded;
};


/**
 * Removes rough edges from a URI by escaping any raw HTML/JS string delimiters.
 *
 * @param {*} value The value to escape. May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} An escaped version of value.
 */
soy.$$normalizeUri = function(value) {
  return soy.esc.$$normalizeUriHelper(value);
};


/**
 * Vets a URI's protocol and removes rough edges from a URI by escaping
 * any raw HTML/JS string delimiters.
 *
 * @param {*} value The value to escape. May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} An escaped version of value.
 */
soy.$$filterNormalizeUri = function(value) {
  if (value && value.contentKind == goog.soy.data.SanitizedContentKind.URI) {
    goog.asserts.assert(value.constructor ===
        soydata.SanitizedUri);
    return soy.$$normalizeUri(value);
  }
  return soy.esc.$$filterNormalizeUriHelper(value);
};


/**
 * Escapes a string so it can safely be included inside a quoted CSS string.
 *
 * @param {*} value The value to escape. May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} An escaped version of value.
 */
soy.$$escapeCssString = function(value) {
  return soy.esc.$$escapeCssStringHelper(value);
};


/**
 * Encodes a value as a CSS identifier part, keyword, or quantity.
 *
 * @param {*} value The value to escape. May not be a string, but the value
 *     will be coerced to a string.
 * @return {string} A safe CSS identifier part, keyword, or quanitity.
 */
soy.$$filterCssValue = function(value) {
  if (value && value.contentKind === goog.soy.data.SanitizedContentKind.CSS) {
    goog.asserts.assert(value.constructor ===
        soydata.SanitizedCss);
    return value.content;
  }
  // Uses == to intentionally match null and undefined for Java compatibility.
  if (value == null) {
    return '';
  }
  return soy.esc.$$filterCssValueHelper(value);
};


/**
 * Sanity-checks noAutoescape input for explicitly tainted content.
 *
 * SanitizedContentKind.TEXT is used to explicitly mark input that was never
 * meant to be used unescaped.
 *
 * @param {*} value The value to filter.
 * @return {string} The value, that we dearly hope will not cause an attack.
 */
soy.$$filterNoAutoescape = function(value) {
  if (value && value.contentKind === goog.soy.data.SanitizedContentKind.TEXT) {
    // Fail in development mode.
    goog.asserts.fail(
        'Tainted SanitizedContentKind.TEXT for |noAutoescape: `%s`',
        [value.content]);
    // Return innocuous data in production.
    return 'zSoyz';
  }
  return String(value);
};


// -----------------------------------------------------------------------------
// Basic directives/functions.


/**
 * Converts \r\n, \r, and \n to <br>s
 * @param {*} str The string in which to convert newlines.
 * @return {string} A copy of {@code str} with converted newlines.
 */
soy.$$changeNewlineToBr = function(str) {
  return goog.string.newLineToBr(String(str), false);
};


/**
 * Inserts word breaks ('wbr' tags) into a HTML string at a given interval. The
 * counter is reset if a space is encountered. Word breaks aren't inserted into
 * HTML tags or entities. Entites count towards the character count; HTML tags
 * do not.
 *
 * @param {*} str The HTML string to insert word breaks into. Can be other
 *     types, but the value will be coerced to a string.
 * @param {number} maxCharsBetweenWordBreaks Maximum number of non-space
 *     characters to allow before adding a word break.
 * @return {string} The string including word breaks.
 */
soy.$$insertWordBreaks = function(str, maxCharsBetweenWordBreaks) {
  return goog.format.insertWordBreaks(String(str), maxCharsBetweenWordBreaks);
};


/**
 * Truncates a string to a given max length (if it's currently longer),
 * optionally adding ellipsis at the end.
 *
 * @param {*} str The string to truncate. Can be other types, but the value will
 *     be coerced to a string.
 * @param {number} maxLen The maximum length of the string after truncation
 *     (including ellipsis, if applicable).
 * @param {boolean} doAddEllipsis Whether to add ellipsis if the string needs
 *     truncation.
 * @return {string} The string after truncation.
 */
soy.$$truncate = function(str, maxLen, doAddEllipsis) {

  str = String(str);
  if (str.length <= maxLen) {
    return str;  // no need to truncate
  }

  // If doAddEllipsis, either reduce maxLen to compensate, or else if maxLen is
  // too small, just turn off doAddEllipsis.
  if (doAddEllipsis) {
    if (maxLen > 3) {
      maxLen -= 3;
    } else {
      doAddEllipsis = false;
    }
  }

  // Make sure truncating at maxLen doesn't cut up a unicode surrogate pair.
  if (soy.$$isHighSurrogate_(str.charAt(maxLen - 1)) &&
      soy.$$isLowSurrogate_(str.charAt(maxLen))) {
    maxLen -= 1;
  }

  // Truncate.
  str = str.substring(0, maxLen);

  // Add ellipsis.
  if (doAddEllipsis) {
    str += '...';
  }

  return str;
};

/**
 * Private helper for $$truncate() to check whether a char is a high surrogate.
 * @param {string} ch The char to check.
 * @return {boolean} Whether the given char is a unicode high surrogate.
 * @private
 */
soy.$$isHighSurrogate_ = function(ch) {
  return 0xD800 <= ch && ch <= 0xDBFF;
};

/**
 * Private helper for $$truncate() to check whether a char is a low surrogate.
 * @param {string} ch The char to check.
 * @return {boolean} Whether the given char is a unicode low surrogate.
 * @private
 */
soy.$$isLowSurrogate_ = function(ch) {
  return 0xDC00 <= ch && ch <= 0xDFFF;
};


// -----------------------------------------------------------------------------
// Bidi directives/functions.


/**
 * Cache of bidi formatter by context directionality, so we don't keep on
 * creating new objects.
 * @type {!Object.<!goog.i18n.BidiFormatter>}
 * @private
 */
soy.$$bidiFormatterCache_ = {};


/**
 * Returns cached bidi formatter for bidiGlobalDir, or creates a new one.
 * @param {number} bidiGlobalDir The global directionality context: 1 if ltr, -1
 *     if rtl, 0 if unknown.
 * @return {goog.i18n.BidiFormatter} A formatter for bidiGlobalDir.
 * @private
 */
soy.$$getBidiFormatterInstance_ = function(bidiGlobalDir) {
  return soy.$$bidiFormatterCache_[bidiGlobalDir] ||
         (soy.$$bidiFormatterCache_[bidiGlobalDir] =
             new goog.i18n.BidiFormatter(bidiGlobalDir));
};


/**
 * Estimate the overall directionality of text. If opt_isHtml, makes sure to
 * ignore the LTR nature of the mark-up and escapes in text, making the logic
 * suitable for HTML and HTML-escaped text.
 * @param {string} text The text whose directionality is to be estimated.
 * @param {boolean=} opt_isHtml Whether text is HTML/HTML-escaped.
 *     Default: false.
 * @return {number} 1 if text is LTR, -1 if it is RTL, and 0 if it is neutral.
 */
soy.$$bidiTextDir = function(text, opt_isHtml) {
  if (!text) {
    return 0;
  }
  return goog.i18n.bidi.detectRtlDirectionality(text, opt_isHtml) ? -1 : 1;
};


/**
 * Returns 'dir="ltr"' or 'dir="rtl"', depending on text's estimated
 * directionality, if it is not the same as bidiGlobalDir.
 * Otherwise, returns the empty string.
 * If opt_isHtml, makes sure to ignore the LTR nature of the mark-up and escapes
 * in text, making the logic suitable for HTML and HTML-escaped text.
 * @param {number} bidiGlobalDir The global directionality context: 1 if ltr, -1
 *     if rtl, 0 if unknown.
 * @param {string} text The text whose directionality is to be estimated.
 * @param {boolean=} opt_isHtml Whether text is HTML/HTML-escaped.
 *     Default: false.
 * @return {soydata.SanitizedHtmlAttribute} 'dir="rtl"' for RTL text in non-RTL
 *     context; 'dir="ltr"' for LTR text in non-LTR context;
 *     else, the empty string.
 */
soy.$$bidiDirAttr = function(bidiGlobalDir, text, opt_isHtml) {
  return soydata.VERY_UNSAFE.ordainSanitizedHtmlAttribute(
      soy.$$getBidiFormatterInstance_(bidiGlobalDir).dirAttr(text, opt_isHtml));
};


/**
 * Returns a Unicode BiDi mark matching bidiGlobalDir (LRM or RLM) if the
 * directionality or the exit directionality of text are opposite to
 * bidiGlobalDir. Otherwise returns the empty string.
 * If opt_isHtml, makes sure to ignore the LTR nature of the mark-up and escapes
 * in text, making the logic suitable for HTML and HTML-escaped text.
 * @param {number} bidiGlobalDir The global directionality context: 1 if ltr, -1
 *     if rtl, 0 if unknown.
 * @param {string} text The text whose directionality is to be estimated.
 * @param {boolean=} opt_isHtml Whether text is HTML/HTML-escaped.
 *     Default: false.
 * @return {string} A Unicode bidi mark matching bidiGlobalDir, or the empty
 *     string when text's overall and exit directionalities both match
 *     bidiGlobalDir, or bidiGlobalDir is 0 (unknown).
 */
soy.$$bidiMarkAfter = function(bidiGlobalDir, text, opt_isHtml) {
  var formatter = soy.$$getBidiFormatterInstance_(bidiGlobalDir);
  return formatter.markAfter(text, opt_isHtml);
};


/**
 * Returns str wrapped in a <span dir="ltr|rtl"> according to its directionality
 * - but only if that is neither neutral nor the same as the global context.
 * Otherwise, returns str unchanged.
 * Always treats str as HTML/HTML-escaped, i.e. ignores mark-up and escapes when
 * estimating str's directionality.
 * @param {number} bidiGlobalDir The global directionality context: 1 if ltr, -1
 *     if rtl, 0 if unknown.
 * @param {*} str The string to be wrapped. Can be other types, but the value
 *     will be coerced to a string.
 * @return {string} The wrapped string.
 */
soy.$$bidiSpanWrap = function(bidiGlobalDir, str) {
  var formatter = soy.$$getBidiFormatterInstance_(bidiGlobalDir);
  return formatter.spanWrap(str + '', true);
};


/**
 * Returns str wrapped in Unicode BiDi formatting characters according to its
 * directionality, i.e. either LRE or RLE at the beginning and PDF at the end -
 * but only if str's directionality is neither neutral nor the same as the
 * global context. Otherwise, returns str unchanged.
 * Always treats str as HTML/HTML-escaped, i.e. ignores mark-up and escapes when
 * estimating str's directionality.
 * @param {number} bidiGlobalDir The global directionality context: 1 if ltr, -1
 *     if rtl, 0 if unknown.
 * @param {*} str The string to be wrapped. Can be other types, but the value
 *     will be coerced to a string.
 * @return {string} The wrapped string.
 */
soy.$$bidiUnicodeWrap = function(bidiGlobalDir, str) {
  var formatter = soy.$$getBidiFormatterInstance_(bidiGlobalDir);
  return formatter.unicodeWrap(str + '', true);
};


// -----------------------------------------------------------------------------
// Generated code.


// START GENERATED CODE FOR ESCAPERS.

/**
 * @type {function (*) : string}
 */
soy.esc.$$escapeUriHelper = function(v) {
  return goog.string.urlEncode(String(v));
};

/**
 * Maps charcters to the escaped versions for the named escape directives.
 * @type {Object.<string, string>}
 * @private
 */
soy.esc.$$ESCAPE_MAP_FOR_ESCAPE_HTML__AND__NORMALIZE_HTML__AND__ESCAPE_HTML_NOSPACE__AND__NORMALIZE_HTML_NOSPACE_ = {
  '\x00': '\x26#0;',
  '\x22': '\x26quot;',
  '\x26': '\x26amp;',
  '\x27': '\x26#39;',
  '\x3c': '\x26lt;',
  '\x3e': '\x26gt;',
  '\x09': '\x26#9;',
  '\x0a': '\x26#10;',
  '\x0b': '\x26#11;',
  '\x0c': '\x26#12;',
  '\x0d': '\x26#13;',
  ' ': '\x26#32;',
  '-': '\x26#45;',
  '\/': '\x26#47;',
  '\x3d': '\x26#61;',
  '`': '\x26#96;',
  '\x85': '\x26#133;',
  '\xa0': '\x26#160;',
  '\u2028': '\x26#8232;',
  '\u2029': '\x26#8233;'
};

/**
 * A function that can be used with String.replace..
 * @param {string} ch A single character matched by a compatible matcher.
 * @return {string} A token in the output language.
 * @private
 */
soy.esc.$$REPLACER_FOR_ESCAPE_HTML__AND__NORMALIZE_HTML__AND__ESCAPE_HTML_NOSPACE__AND__NORMALIZE_HTML_NOSPACE_ = function(ch) {
  return soy.esc.$$ESCAPE_MAP_FOR_ESCAPE_HTML__AND__NORMALIZE_HTML__AND__ESCAPE_HTML_NOSPACE__AND__NORMALIZE_HTML_NOSPACE_[ch];
};

/**
 * Maps charcters to the escaped versions for the named escape directives.
 * @type {Object.<string, string>}
 * @private
 */
soy.esc.$$ESCAPE_MAP_FOR_ESCAPE_JS_STRING__AND__ESCAPE_JS_REGEX_ = {
  '\x00': '\\x00',
  '\x08': '\\x08',
  '\x09': '\\t',
  '\x0a': '\\n',
  '\x0b': '\\x0b',
  '\x0c': '\\f',
  '\x0d': '\\r',
  '\x22': '\\x22',
  '\x26': '\\x26',
  '\x27': '\\x27',
  '\/': '\\\/',
  '\x3c': '\\x3c',
  '\x3d': '\\x3d',
  '\x3e': '\\x3e',
  '\\': '\\\\',
  '\x85': '\\x85',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
  '$': '\\x24',
  '(': '\\x28',
  ')': '\\x29',
  '*': '\\x2a',
  '+': '\\x2b',
  ',': '\\x2c',
  '-': '\\x2d',
  '.': '\\x2e',
  ':': '\\x3a',
  '?': '\\x3f',
  '[': '\\x5b',
  ']': '\\x5d',
  '^': '\\x5e',
  '{': '\\x7b',
  '|': '\\x7c',
  '}': '\\x7d'
};

/**
 * A function that can be used with String.replace..
 * @param {string} ch A single character matched by a compatible matcher.
 * @return {string} A token in the output language.
 * @private
 */
soy.esc.$$REPLACER_FOR_ESCAPE_JS_STRING__AND__ESCAPE_JS_REGEX_ = function(ch) {
  return soy.esc.$$ESCAPE_MAP_FOR_ESCAPE_JS_STRING__AND__ESCAPE_JS_REGEX_[ch];
};

/**
 * Maps charcters to the escaped versions for the named escape directives.
 * @type {Object.<string, string>}
 * @private
 */
soy.esc.$$ESCAPE_MAP_FOR_ESCAPE_CSS_STRING_ = {
  '\x00': '\\0 ',
  '\x08': '\\8 ',
  '\x09': '\\9 ',
  '\x0a': '\\a ',
  '\x0b': '\\b ',
  '\x0c': '\\c ',
  '\x0d': '\\d ',
  '\x22': '\\22 ',
  '\x26': '\\26 ',
  '\x27': '\\27 ',
  '(': '\\28 ',
  ')': '\\29 ',
  '*': '\\2a ',
  '\/': '\\2f ',
  ':': '\\3a ',
  ';': '\\3b ',
  '\x3c': '\\3c ',
  '\x3d': '\\3d ',
  '\x3e': '\\3e ',
  '@': '\\40 ',
  '\\': '\\5c ',
  '{': '\\7b ',
  '}': '\\7d ',
  '\x85': '\\85 ',
  '\xa0': '\\a0 ',
  '\u2028': '\\2028 ',
  '\u2029': '\\2029 '
};

/**
 * A function that can be used with String.replace..
 * @param {string} ch A single character matched by a compatible matcher.
 * @return {string} A token in the output language.
 * @private
 */
soy.esc.$$REPLACER_FOR_ESCAPE_CSS_STRING_ = function(ch) {
  return soy.esc.$$ESCAPE_MAP_FOR_ESCAPE_CSS_STRING_[ch];
};

/**
 * Maps charcters to the escaped versions for the named escape directives.
 * @type {Object.<string, string>}
 * @private
 */
soy.esc.$$ESCAPE_MAP_FOR_NORMALIZE_URI__AND__FILTER_NORMALIZE_URI_ = {
  '\x00': '%00',
  '\x01': '%01',
  '\x02': '%02',
  '\x03': '%03',
  '\x04': '%04',
  '\x05': '%05',
  '\x06': '%06',
  '\x07': '%07',
  '\x08': '%08',
  '\x09': '%09',
  '\x0a': '%0A',
  '\x0b': '%0B',
  '\x0c': '%0C',
  '\x0d': '%0D',
  '\x0e': '%0E',
  '\x0f': '%0F',
  '\x10': '%10',
  '\x11': '%11',
  '\x12': '%12',
  '\x13': '%13',
  '\x14': '%14',
  '\x15': '%15',
  '\x16': '%16',
  '\x17': '%17',
  '\x18': '%18',
  '\x19': '%19',
  '\x1a': '%1A',
  '\x1b': '%1B',
  '\x1c': '%1C',
  '\x1d': '%1D',
  '\x1e': '%1E',
  '\x1f': '%1F',
  ' ': '%20',
  '\x22': '%22',
  '\x27': '%27',
  '(': '%28',
  ')': '%29',
  '\x3c': '%3C',
  '\x3e': '%3E',
  '\\': '%5C',
  '{': '%7B',
  '}': '%7D',
  '\x7f': '%7F',
  '\x85': '%C2%85',
  '\xa0': '%C2%A0',
  '\u2028': '%E2%80%A8',
  '\u2029': '%E2%80%A9',
  '\uff01': '%EF%BC%81',
  '\uff03': '%EF%BC%83',
  '\uff04': '%EF%BC%84',
  '\uff06': '%EF%BC%86',
  '\uff07': '%EF%BC%87',
  '\uff08': '%EF%BC%88',
  '\uff09': '%EF%BC%89',
  '\uff0a': '%EF%BC%8A',
  '\uff0b': '%EF%BC%8B',
  '\uff0c': '%EF%BC%8C',
  '\uff0f': '%EF%BC%8F',
  '\uff1a': '%EF%BC%9A',
  '\uff1b': '%EF%BC%9B',
  '\uff1d': '%EF%BC%9D',
  '\uff1f': '%EF%BC%9F',
  '\uff20': '%EF%BC%A0',
  '\uff3b': '%EF%BC%BB',
  '\uff3d': '%EF%BC%BD'
};

/**
 * A function that can be used with String.replace..
 * @param {string} ch A single character matched by a compatible matcher.
 * @return {string} A token in the output language.
 * @private
 */
soy.esc.$$REPLACER_FOR_NORMALIZE_URI__AND__FILTER_NORMALIZE_URI_ = function(ch) {
  return soy.esc.$$ESCAPE_MAP_FOR_NORMALIZE_URI__AND__FILTER_NORMALIZE_URI_[ch];
};

/**
 * Matches characters that need to be escaped for the named directives.
 * @type RegExp
 * @private
 */
soy.esc.$$MATCHER_FOR_ESCAPE_HTML_ = /[\x00\x22\x26\x27\x3c\x3e]/g;

/**
 * Matches characters that need to be escaped for the named directives.
 * @type RegExp
 * @private
 */
soy.esc.$$MATCHER_FOR_NORMALIZE_HTML_ = /[\x00\x22\x27\x3c\x3e]/g;

/**
 * Matches characters that need to be escaped for the named directives.
 * @type RegExp
 * @private
 */
soy.esc.$$MATCHER_FOR_ESCAPE_HTML_NOSPACE_ = /[\x00\x09-\x0d \x22\x26\x27\x2d\/\x3c-\x3e`\x85\xa0\u2028\u2029]/g;

/**
 * Matches characters that need to be escaped for the named directives.
 * @type RegExp
 * @private
 */
soy.esc.$$MATCHER_FOR_NORMALIZE_HTML_NOSPACE_ = /[\x00\x09-\x0d \x22\x27\x2d\/\x3c-\x3e`\x85\xa0\u2028\u2029]/g;

/**
 * Matches characters that need to be escaped for the named directives.
 * @type RegExp
 * @private
 */
soy.esc.$$MATCHER_FOR_ESCAPE_JS_STRING_ = /[\x00\x08-\x0d\x22\x26\x27\/\x3c-\x3e\\\x85\u2028\u2029]/g;

/**
 * Matches characters that need to be escaped for the named directives.
 * @type RegExp
 * @private
 */
soy.esc.$$MATCHER_FOR_ESCAPE_JS_REGEX_ = /[\x00\x08-\x0d\x22\x24\x26-\/\x3a\x3c-\x3f\x5b-\x5e\x7b-\x7d\x85\u2028\u2029]/g;

/**
 * Matches characters that need to be escaped for the named directives.
 * @type RegExp
 * @private
 */
soy.esc.$$MATCHER_FOR_ESCAPE_CSS_STRING_ = /[\x00\x08-\x0d\x22\x26-\x2a\/\x3a-\x3e@\\\x7b\x7d\x85\xa0\u2028\u2029]/g;

/**
 * Matches characters that need to be escaped for the named directives.
 * @type RegExp
 * @private
 */
soy.esc.$$MATCHER_FOR_NORMALIZE_URI__AND__FILTER_NORMALIZE_URI_ = /[\x00- \x22\x27-\x29\x3c\x3e\\\x7b\x7d\x7f\x85\xa0\u2028\u2029\uff01\uff03\uff04\uff06-\uff0c\uff0f\uff1a\uff1b\uff1d\uff1f\uff20\uff3b\uff3d]/g;

/**
 * A pattern that vets values produced by the named directives.
 * @type RegExp
 * @private
 */
soy.esc.$$FILTER_FOR_FILTER_CSS_VALUE_ = /^(?!-*(?:expression|(?:moz-)?binding))(?:[.#]?-?(?:[_a-z0-9-]+)(?:-[_a-z0-9-]+)*-?|-?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[a-z]{1,2}|%)?|!important|)$/i;

/**
 * A pattern that vets values produced by the named directives.
 * @type RegExp
 * @private
 */
soy.esc.$$FILTER_FOR_FILTER_NORMALIZE_URI_ = /^(?:(?:https?|mailto):|[^&:\/?#]*(?:[\/?#]|$))/i;

/**
 * A pattern that vets values produced by the named directives.
 * @type RegExp
 * @private
 */
soy.esc.$$FILTER_FOR_FILTER_HTML_ATTRIBUTES_ = /^(?!style|on|action|archive|background|cite|classid|codebase|data|dsync|href|longdesc|src|usemap)(?:[a-z0-9_$:-]*)$/i;

/**
 * A pattern that vets values produced by the named directives.
 * @type RegExp
 * @private
 */
soy.esc.$$FILTER_FOR_FILTER_HTML_ELEMENT_NAME_ = /^(?!script|style|title|textarea|xmp|no)[a-z0-9_$:-]*$/i;

/**
 * A helper for the Soy directive |escapeHtml
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
soy.esc.$$escapeHtmlHelper = function(value) {
  var str = String(value);
  return str.replace(
      soy.esc.$$MATCHER_FOR_ESCAPE_HTML_,
      soy.esc.$$REPLACER_FOR_ESCAPE_HTML__AND__NORMALIZE_HTML__AND__ESCAPE_HTML_NOSPACE__AND__NORMALIZE_HTML_NOSPACE_);
};

/**
 * A helper for the Soy directive |normalizeHtml
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
soy.esc.$$normalizeHtmlHelper = function(value) {
  var str = String(value);
  return str.replace(
      soy.esc.$$MATCHER_FOR_NORMALIZE_HTML_,
      soy.esc.$$REPLACER_FOR_ESCAPE_HTML__AND__NORMALIZE_HTML__AND__ESCAPE_HTML_NOSPACE__AND__NORMALIZE_HTML_NOSPACE_);
};

/**
 * A helper for the Soy directive |escapeHtmlNospace
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
soy.esc.$$escapeHtmlNospaceHelper = function(value) {
  var str = String(value);
  return str.replace(
      soy.esc.$$MATCHER_FOR_ESCAPE_HTML_NOSPACE_,
      soy.esc.$$REPLACER_FOR_ESCAPE_HTML__AND__NORMALIZE_HTML__AND__ESCAPE_HTML_NOSPACE__AND__NORMALIZE_HTML_NOSPACE_);
};

/**
 * A helper for the Soy directive |normalizeHtmlNospace
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
soy.esc.$$normalizeHtmlNospaceHelper = function(value) {
  var str = String(value);
  return str.replace(
      soy.esc.$$MATCHER_FOR_NORMALIZE_HTML_NOSPACE_,
      soy.esc.$$REPLACER_FOR_ESCAPE_HTML__AND__NORMALIZE_HTML__AND__ESCAPE_HTML_NOSPACE__AND__NORMALIZE_HTML_NOSPACE_);
};

/**
 * A helper for the Soy directive |escapeJsString
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
soy.esc.$$escapeJsStringHelper = function(value) {
  var str = String(value);
  return str.replace(
      soy.esc.$$MATCHER_FOR_ESCAPE_JS_STRING_,
      soy.esc.$$REPLACER_FOR_ESCAPE_JS_STRING__AND__ESCAPE_JS_REGEX_);
};

/**
 * A helper for the Soy directive |escapeJsRegex
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
soy.esc.$$escapeJsRegexHelper = function(value) {
  var str = String(value);
  return str.replace(
      soy.esc.$$MATCHER_FOR_ESCAPE_JS_REGEX_,
      soy.esc.$$REPLACER_FOR_ESCAPE_JS_STRING__AND__ESCAPE_JS_REGEX_);
};

/**
 * A helper for the Soy directive |escapeCssString
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
soy.esc.$$escapeCssStringHelper = function(value) {
  var str = String(value);
  return str.replace(
      soy.esc.$$MATCHER_FOR_ESCAPE_CSS_STRING_,
      soy.esc.$$REPLACER_FOR_ESCAPE_CSS_STRING_);
};

/**
 * A helper for the Soy directive |filterCssValue
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
soy.esc.$$filterCssValueHelper = function(value) {
  var str = String(value);
  if (!soy.esc.$$FILTER_FOR_FILTER_CSS_VALUE_.test(str)) {
    goog.asserts.fail('Bad value `%s` for |filterCssValue', [str]);
    return 'zSoyz';
  }
  return str;
};

/**
 * A helper for the Soy directive |normalizeUri
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
soy.esc.$$normalizeUriHelper = function(value) {
  var str = String(value);
  return str.replace(
      soy.esc.$$MATCHER_FOR_NORMALIZE_URI__AND__FILTER_NORMALIZE_URI_,
      soy.esc.$$REPLACER_FOR_NORMALIZE_URI__AND__FILTER_NORMALIZE_URI_);
};

/**
 * A helper for the Soy directive |filterNormalizeUri
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
soy.esc.$$filterNormalizeUriHelper = function(value) {
  var str = String(value);
  if (!soy.esc.$$FILTER_FOR_FILTER_NORMALIZE_URI_.test(str)) {
    goog.asserts.fail('Bad value `%s` for |filterNormalizeUri', [str]);
    return '#zSoyz';
  }
  return str.replace(
      soy.esc.$$MATCHER_FOR_NORMALIZE_URI__AND__FILTER_NORMALIZE_URI_,
      soy.esc.$$REPLACER_FOR_NORMALIZE_URI__AND__FILTER_NORMALIZE_URI_);
};

/**
 * A helper for the Soy directive |filterHtmlAttributes
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
soy.esc.$$filterHtmlAttributesHelper = function(value) {
  var str = String(value);
  if (!soy.esc.$$FILTER_FOR_FILTER_HTML_ATTRIBUTES_.test(str)) {
    goog.asserts.fail('Bad value `%s` for |filterHtmlAttributes', [str]);
    return 'zSoyz';
  }
  return str;
};

/**
 * A helper for the Soy directive |filterHtmlElementName
 * @param {*} value Can be of any type but will be coerced to a string.
 * @return {string} The escaped text.
 */
soy.esc.$$filterHtmlElementNameHelper = function(value) {
  var str = String(value);
  if (!soy.esc.$$FILTER_FOR_FILTER_HTML_ELEMENT_NAME_.test(str)) {
    goog.asserts.fail('Bad value `%s` for |filterHtmlElementName', [str]);
    return 'zSoyz';
  }
  return str;
};

/**
 * Matches all tags, HTML comments, and DOCTYPEs in tag soup HTML.
 * By removing these, and replacing any '<' or '>' characters with
 * entities we guarantee that the result can be embedded into a
 * an attribute without introducing a tag boundary.
 *
 * @type {RegExp}
 * @private
 */
soy.esc.$$HTML_TAG_REGEX_ = /<(?:!|\/?([a-zA-Z][a-zA-Z0-9:\-]*))(?:[^>'"]|"[^"]*"|'[^']*')*>/g;

/**
 * Matches all occurrences of '<'.
 *
 * @type {RegExp}
 * @private
 */
soy.esc.$$LT_REGEX_ = /</g;

/**
 * Maps lower-case names of innocuous tags to 1.
 *
 * @type {Object.<string,number>}
 * @private
 */
soy.esc.$$SAFE_TAG_WHITELIST_ = {'b': 1, 'br': 1, 'em': 1, 'i': 1, 's': 1, 'sub': 1, 'sup': 1, 'u': 1};

// END GENERATED CODE// This file was automatically generated from fbldr-create.soy.
// Please don't edit this file by hand.

if (typeof jive == 'undefined') { var jive = {}; }
if (typeof jive.fbldr == 'undefined') { jive.fbldr = {}; }
if (typeof jive.fbldr.create == 'undefined') { jive.fbldr.create = {}; }
if (typeof jive.fbldr.create.soy == 'undefined') { jive.fbldr.create.soy = {}; }


jive.fbldr.create.soy.addField = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<div class="fbldr-field"><label class="fbldr-label">Add Field</label><span class="fbldr-glyph fbldr-reqd">&nbsp;</span><button type="button" id="fbldr-field-add">Add Field</button></div><div id="fbldr-create-error-box" class="fbldr-error-box" style="display: none"><span class="jive-icon-med jive-icon-redalert"></span><span class="message"></span></div>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.create.soy.field = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<li><div class="fbldr-create-field"><input type="hidden" value="', soy.$$escapeHtml(opt_data.json), '"/><span class="fbldr-create-field-id">', soy.$$escapeHtml(opt_data.field.id), '</span><span class="fbldr-create-field-label" ', (opt_data.field.desc) ? 'title="' + soy.$$escapeHtml(opt_data.field.desc) + '"' : '', '>', soy.$$escapeHtml(opt_data.field.label), '</span><a class="fbldr-field-link fbldr-field-del" href="#" title="Remove Field"><span class="jive-icon-med jive-icon-delete"></span></a><a class="fbldr-field-link fbldr-field-down" href="#" title="Move Field Down"><span class="jive-icon-med jive-icon-arrow-down"></span></a><a class="fbldr-field-link fbldr-field-up" href="#" title="Move Field Up"><span class="jive-icon-med jive-icon-arrow-up"></span></a></div></li>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.create.soy.headingText = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<div class="fbldr-create-preview-text"><p>Use the panels on the right to enter the template and field information, which will automatically render the form preview below.</p><p>&nbsp;</p><p>Once the form has been successfully created, you may either fill out the form and preview the content in the Content Preview tab, or copy the generated form template from the Form Source tab and store in a Jive document to be used by the Forms App.</p></div>');
  return opt_sb ? '' : output.toString();
};
// This file was automatically generated from fbldr.soy.
// Please don't edit this file by hand.

if (typeof jive == 'undefined') { var jive = {}; }
if (typeof jive.fbldr == 'undefined') { jive.fbldr = {}; }
if (typeof jive.fbldr.soy == 'undefined') { jive.fbldr.soy = {}; }


jive.fbldr.soy.attachments = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<div class="fbldr-attachments"><div class="fbldr-attach-head"><p>Use the following form to upload file attachments and, optionally, include a variable to reference the uploaded file in the form\'s HTML source.</p><p>Multiple files may be attached, but only one at a time.  Click "Finished" when all files have been attached.</p></div><div class="fbldr-attach-field"><label>Link to HTML Variable (optional) : </label></div><div class="fbldr-attach-field"><select id="fbldr-attach-link"><option value="" selected="selected">Select HTML variable...</option>');
  var optionList23 = opt_data.variables;
  var optionListLen23 = optionList23.length;
  for (var optionIndex23 = 0; optionIndex23 < optionListLen23; optionIndex23++) {
    var optionData23 = optionList23[optionIndex23];
    output.append('<option value="', soy.$$escapeHtml(optionData23), '">', soy.$$escapeHtml(optionData23), '</option>');
  }
  output.append('</select></div><div class="fbldr-attach-field"><button type="button" id="fbldr-attach-file">Upload File to Attach</button></div><div class="fbldr-attach-field"><label>Attached Files : </label><br/><ul id="fbldr-attach-files"></ul></div></div>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.attachFile = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<li>', soy.$$escapeHtml(opt_data.attachment.name), ' ', (opt_data.linkTo) ? '<span class="fbldr-attach-link-to">(linked to \'' + soy.$$escapeHtml(opt_data.linkTo) + '\')</span>' : '', '</li>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.attachImage = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<img alt="', soy.$$escapeHtml(opt_data.filename), '" class="jive-image" src="/servlet/JiveServlet/download/', soy.$$escapeHtml(opt_data.docId), '-1-', soy.$$escapeHtml(opt_data.attachId), '/', soy.$$escapeHtml(opt_data.filename), '" />');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.attachLink = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<a href="/servlet/JiveServlet/download/', soy.$$escapeHtml(opt_data.docId), '-1-', soy.$$escapeHtml(opt_data.attachId), '/', soy.$$escapeHtml(opt_data.filename), '">', soy.$$escapeHtml(opt_data.filename), '</a>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.checkbox = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<div class="fbldr-field">');
  jive.fbldr.soy.label(opt_data, output);
  output.append('<input type="checkbox" id="fbldr-field-', soy.$$escapeHtml(opt_data.field.id), '" class="fbldr-checkbox" ', (opt_data.field.value) ? 'checked="checked"' : '', ' ', (opt_data.field.name) ? 'name="' + soy.$$escapeHtml(opt_data.field.name) + '"' : '', ' /></div>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.divider = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<div class="fbldr-divider">&nbsp;</div>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.error = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<span id="fbldr-error-', soy.$$escapeHtml(opt_data.field.id), '" class="jive-icon-sml jive-icon-redalert fbldr-error" style="display: none;" title=""></span>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.form = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<form id="', soy.$$escapeHtml(opt_data.id), '" class="fbldr-form"></form>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.header = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<div class="fbldr-header"><!-- <h2 class="fbldr-name">', soy.$$escapeHtml(opt_data.name), '</h2> -->', (opt_data.desc) ? '<span class="fbldr-desc">' + soy.$$escapeHtml(opt_data.desc) + '</span>' : '', '</div>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.heading = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<div class="fbldr-heading"><span class="fbldr-heading-index">', soy.$$escapeHtml(opt_data.index), '</span><span class="fbldr-heading-text">', soy.$$escapeHtml(opt_data.text), '</span></div>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.label = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<label class="fbldr-label">', soy.$$escapeHtml(opt_data.field.label), '</label><span class="fbldr-glyph fbldr-reqd">', (opt_data.field.required) ? '*' : '&nbsp;', '</span>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.load = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<div id="fbldr-load"><span class="fbldr-load-img"></span><span class="fbldr-load-msg">Loading templates...</span><div id="fbldr-load-progress"><div class="fbldr-progress-text"></div></div></div>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.options = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<option value="" class="fbldr-none">Select an option...</option>');
  var optionList117 = opt_data.values;
  var optionListLen117 = optionList117.length;
  for (var optionIndex117 = 0; optionIndex117 < optionListLen117; optionIndex117++) {
    var optionData117 = optionList117[optionIndex117];
    output.append('<option class="fbldr-opt ', (optionData117.cssClass) ? soy.$$escapeHtml(optionData117.cssClass) : '', '" value="', soy.$$escapeHtml(optionData117.value), '" ', (optionData117.value == opt_data.value) ? ' selected="selected"' : '', '>', soy.$$escapeHtml(optionData117.label), '</option>');
  }
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.notes = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<div class="fbldr-notes"><div class="fbldr-note"><span class="fbldr-glyph fbldr-reqd">*</span> Indicates a required field.</div>', (opt_data.includeAttachment) ? '<div class="fbldr-note"><span class="fbldr-glyph fbldr-glyph-tall">+</span>File attachments will be included during form content submission.</div>' : '', '</div>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.radio = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<div class="fbldr-field">');
  jive.fbldr.soy.label(opt_data, output);
  jive.fbldr.soy.radioOptions(opt_data, output);
  jive.fbldr.soy.error(opt_data, output);
  jive.fbldr.soy.title(opt_data, output);
  output.append('</div>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.radioOptions = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<ul class="fbldr-field-list">');
  var valueList147 = opt_data.field.values;
  var valueListLen147 = valueList147.length;
  for (var valueIndex147 = 0; valueIndex147 < valueListLen147; valueIndex147++) {
    var valueData147 = valueList147[valueIndex147];
    output.append('<li><input type="radio" id="fbldr-field-', soy.$$escapeHtml(opt_data.field.id), '" class="fbldr-radio" ', (opt_data.field.name) ? 'name="' + soy.$$escapeHtml(opt_data.field.name) + '" value="' + soy.$$escapeHtml(valueData147.value) + '"' : '', (opt_data.field.value == valueData147.value) ? 'checked="checked"' : '', ' />', (valueData147.label) ? ' ' + soy.$$escapeHtml(valueData147.label) + ' ' : ' ' + soy.$$escapeHtml(valueData147.value) + ' ', '</li>');
  }
  output.append('</ul>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.select = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<div class="fbldr-field">');
  jive.fbldr.soy.label(opt_data, output);
  output.append('<select id="fbldr-field-', soy.$$escapeHtml(opt_data.field.id), '" class="fbldr-input" ', (opt_data.field.name) ? 'name="' + soy.$$escapeHtml(opt_data.field.name) + '"' : '', '>');
  jive.fbldr.soy.options({values: opt_data.field.values, value: opt_data.field.value}, output);
  output.append('</select>');
  jive.fbldr.soy.error(opt_data, output);
  jive.fbldr.soy.title(opt_data, output);
  output.append('</div>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.start = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<div id="fbldr-start"><span class="fbldr-desc">You do not appear to have any forms currently available for use.</span><br /><div class="fbldr-text">In order to begin using the Forms App, there must be forms available in your community and your app must be proprely configured to locate those forms.  See the following help topics in the<span class="jive-icon-med jive-icon-question"></span>Forms App Help (upper-right) for further information:</div><ul><li><span class="jive-icon-med jive-icon-question"></span>Help Setting Up the App - See the "Configuring the App" help topic.<li><span class="jive-icon-med jive-icon-question"></span>Help Creating Custom Forms - See the "Getting Started" or "Additional Resources" help topics.</li></ul></div>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.submit = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<div id="fbldr-submit" class="clearfix"><button type="button" id="fbldr-submit-btn">', (opt_data.label) ? soy.$$escapeHtml(opt_data.label) : 'Submit Form', '</button><div id="fbldr-submit-status"></div></div>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.submitStatus = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append((opt_data.iconSrc) ? '<img class="' + soy.$$escapeHtml(opt_data.iconCss) + '" src="' + soy.$$escapeHtml(opt_data.iconSrc) + '" />' : (opt_data.iconCss) ? '<span class="jive-icon jive-icon-med ' + soy.$$escapeHtml(opt_data.iconCss) + '"></span>' : '', '<span class="fbldr-submit-text">', opt_data.statusHtml, '</span>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.submitSuccess = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append((opt_data.content.href) ? '<a href="' + soy.$$escapeHtml(opt_data.content.href) + '" target="_blank" title="View ' + soy.$$escapeHtml(opt_data.content.contentType) + ': ' + soy.$$escapeHtml(opt_data.content.subject) + '">' + soy.$$escapeHtml(opt_data.text) + '</a>' : '<span class="fbldr-submit-success">' + soy.$$escapeHtml(opt_data.text) + '</span>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.text = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<div class="fbldr-field">');
  jive.fbldr.soy.label(opt_data, output);
  output.append('<input type="text" id="fbldr-field-', soy.$$escapeHtml(opt_data.field.id), '" class="fbldr-input" value="', (opt_data.field.value) ? soy.$$escapeHtml(opt_data.field.value) : '', '" ', (opt_data.field.name) ? 'name="' + soy.$$escapeHtml(opt_data.field.name) + '"' : '', ' />');
  jive.fbldr.soy.error(opt_data, output);
  jive.fbldr.soy.title(opt_data, output);
  output.append('</div>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.textarea = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<div class="fbldr-field">');
  jive.fbldr.soy.label(opt_data, output);
  output.append('<textarea id="fbldr-field-', soy.$$escapeHtml(opt_data.field.id), '" class="fbldr-input" rows="4">', (opt_data.field.value) ? soy.$$escapeHtml(opt_data.field.value) : '', '</textarea>');
  jive.fbldr.soy.error(opt_data, output);
  jive.fbldr.soy.title(opt_data, output);
  output.append('</div>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.title = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append((opt_data.field.title) ? '<span class="jive-icon-sml jive-icon-info fbldr-title" title="' + soy.$$escapeHtml(opt_data.field.title) + '"></span>' : '');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.userlink = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<a __jive_macro_name="user" __default_attr="', soy.$$escapeHtml(opt_data.userId), '" class="jive_macro jive_macro_user" href="">', soy.$$escapeHtml(opt_data.name), '</a>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.userpicker = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<div class="fbldr-field">');
  jive.fbldr.soy.label(opt_data, output);
  output.append('<a href="#" id="fbldr-link-', soy.$$escapeHtml(opt_data.field.id), '" class="fbldr-userpicker-link fbldr-input">select users</a>');
  jive.fbldr.soy.error(opt_data, output);
  jive.fbldr.soy.title(opt_data, output);
  output.append('<ul id="fbldr-field-', soy.$$escapeHtml(opt_data.field.id), '" class="fbldr-userpicker-list"></ul></div>');
  return opt_sb ? '' : output.toString();
};


jive.fbldr.soy.validationErrors = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('<div class="fbldr-valid-errors">');
  var errorList292 = opt_data.errors;
  var errorListLen292 = errorList292.length;
  for (var errorIndex292 = 0; errorIndex292 < errorListLen292; errorIndex292++) {
    var errorData292 = errorList292[errorIndex292];
    output.append('<div class="fbldr-valid-error"><span class="jive-icon-sml jive-icon-redalert fbldr-error"></span>&nbsp;<span class="fbldr-valid-error-text">', soy.$$escapeHtml(errorData292), '</span></div>');
  }
  output.append('</div>');
  return opt_sb ? '' : output.toString();
};
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

jive = jive || {};
jive.fbldr = jive.fbldr || {};

$j = jQuery.noConflict();

jive.fbldr.dataFilter = function(data, type) {
    return type === 'json' ? $j.trim(data.replace(/^throw [^;]*;/, '')) : data;
};

jive.fbldr.isDebug = function() {
	if (gadgets) {
		var prefs = new gadgets.Prefs();
		return prefs.getBool("fbldr_debug");
	}
	else {
		return true;
	}
}

jive.fbldr.isEmbedded = function() {
    return ($j("body#fbldr-body-embed").length > 0);
}

jive.fbldr.errorMessage = function(msg) {
    var $p = $j('<p/>').html(msg);
    $j('<div title="Error"/>').append($p).dialog({modal: true}); 
};

jive.fbldr.successMessage = function(msg) {
    var $p = $j('<p/>').html(msg);
    $j('<div title="Success"/>').append($p).dialog({modal: true}); 
};

(function ($) {
    $.extend({      
        getQueryString: function (name) {           
            function parseParams() {
                try {
                    var params = {},
                        e,
                        a = /\+/g,  // Regex for replacing addition symbol with a space
                        r = /([^&=]+)=?([^&]*)/g,
                        d = function (s) { return decodeURIComponent(s.replace(a, " ")); },
                        q = window.parent.location.search.substring(1);
    
                    while (e = r.exec(q))
                        params[d(e[1])] = d(e[2]);
    
                    return params;
                }
                catch(e) {
                    // handle security exception in case apps are not in same domain as site
                    return {};
                }
            }

            if (!this.queryStringParams)
                this.queryStringParams = parseParams(); 

            return this.queryStringParams[name];
        },
        getViewParam: function (name) {
            if (gadgets) {
                var viewParams = gadgets.views.getParams();
                return viewParams[name];
            }
            else {
                return null;
            }
        }
    });
})(jQuery);
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

jive.fbldr.ContentCreator = function(template, form) {
    
    var prefs = new gadgets.Prefs();
    
    var create = function(callback) {
        var title = parse(template.content.title);
        var body = parse(template.content.body);
        
        if (jive.fbldr.isEmbedded()) {
            osapi.jive.core.container.editor().insert(body);
        }
        else {
        	getContainer(function(container) {
        		if (container.error) {
        		    callback({ error: container.error });
        		}
        		else {
        			createContent(container, { title: title, body: body }, callback);
        		}
        	});
        }
    };
    
    var preview = function() {
        var title = parse(template.content.title);
        var body = parse(template.content.body);
        
        return {
            title: title,
            body: body
        }
    };
    
    var parse = function(text) {
        var replaced = text;
        for (var i = 0; i < template.fields.length; i++) {
            var field = template.fields[i];
            var value = getFieldValue(field);
            var valueRegex = new RegExp("\\{\\$" + field.id + "\\}", "g");
            var labelRegex = new RegExp("\\{\\$" + field.id + "\\.label\\}", "g");
            replaced = replaced.replace(valueRegex, value);
            replaced = replaced.replace(labelRegex, field.label);
        }
        return replaced;
    };
    
    var getFieldValue = function(field) {
        var value;
        
        if (field.type == "userpicker") {
            value = getUserPickerValues(field);
        }
        else if (field.type == "userselect") {
            value = getUserSelectValues(field);
        }
        else {
            value = getSafeValue(field);
        }
        
        return value;
    }
    
    var getUserPickerValues = function(field) {
        var userLinks = new Array();
        var users = $j(form).find("#fbldr-field-" + field.id).find('li');
        for (var i = 0; i < users.length; i++) {
            var id = $j(users[i]).attr('userid');
            var name = $j(users[i]).attr('username');
            userLinks.push(jive.fbldr.soy.userlink({ userId: id, name: name }));
        }
        return userLinks.join(', ');
    };

    var getUserSelectValues = function(field) {
        // TODO: This doesn't work with !app, and we don't currently have names
        var userLinks = new Array();
        var userIds = $j(form).find("#fbldr-field-" + field.id).val().split(",");
        for (var i = 0; i < userIds.length; i++) {
            var id = $j.trim(userIds[i]);
            userLinks.push(jive.fbldr.soy.userlink({ userId: id, name: '' }));
        }
        return userLinks.join(', ');
    };

    
    var getSafeValue = function(field) {
    	return sanitizeValue($j(form).find("#fbldr-field-" + field.id));
    };
    
    var sanitizeValue = function(element) {
        var value = $j(element).val();
        value = $j.trim(value);
        value = $j('<div/>').text(value).html(); // escapes html tags, etc.
        value = value.replace(/\n/g, '<br/>'); // replace newlines with html breaks
        return value;    	
    }
    
    var createContent = function(container, content, callback) {
    	if (jive.fbldr.isDebug()) {
    		console.log("Create content in container: ", container);
    		console.log("Content title: ", content.title);
    		console.log("Content body: ", content.body);
    	}
    	
        var containerType = container.containerType;
        var containerId = container.containerId;
        
        var contentType = template.content.type;
        var data = { subject: content.title, html: content.body }; 
        
        if (contentType == "document") {
            contentType = "document";
        }
        else if (contentType == "discussion" || contentType == "question") {
            data.question = (contentType == "question");
            contentType = "discussion";
        }
        else {
            var error = "Unable to create content of unknown type: " + contentType;
            callback({ error: error });
            return;
        }
        
        if (containerType == "group") {
            postToGroup(containerId, contentType, data, callback);
        }
        else if (containerType == "project") {
            postToProject(containerId, contentType, data, callback);
        }
        else if (containerType == "space") {
            postToSpace(containerId, contentType, data, callback);
        }
    };
    
    var postToGroup = function(groupId, contentType, data, callback) {
        osapi.jive.core.groups.get({id: groupId}).execute(function(response) {
        	doPost(response, contentType, data, callback);
        });
    };

    var postToProject = function(projectId, contentType, data, callback) {
        osapi.jive.core.projects.get({id: projectId}).execute(function(response) {
        	doPost(response, contentType, data, callback);
        });
    };    

    var postToSpace = function(spaceId, contentType, data, callback) {
        osapi.jive.core.spaces.get({id: spaceId}).execute(function(response) {
            doPost(response, contentType, data, callback);
        });
    };
    
    var doPost = function(response, contentType, data, callback) {
        if (response.error) {
            callback({ error: response.error.message });
            return;
        }

        var container = response.data;
        
        if (contentType == "discussion") {
            postDiscussion(container, data, callback); 
        }
        else if (contentType == "document") {
            postDocument(container, data, callback);
        }
    };
    
    var postDiscussion = function(container, data, callback) {
        container.discussions.create(data).execute(function(response){
            if (response.error) {
                callback({ error: response.error.message });
            }
            else {
                var discussion = response.data;
                discussion.contentType = (data.question) ? "question" : "discussion";
                discussion.href = "/threads/" + response.data.id;
                discussion.subject = data.subject;
                
                /* 
                 * Currently cannot add attachments or images to discussions, at least
                 * not when using Jive Core API v2, revisit when moving to Core API v3
                 *
                if (template.content.includeAttachment) {
                	addAttachments(template, discussion, callback);
                }
                else {
                    doActions(discussion, callback);
                }
                 */
	
                doActions(discussion, callback);
            }
        });
    };

    var postDocument = function(container, data, callback) {
        container.documents.create(data).execute(function(response){
            if (response.error) {
                callback({ error: response.error.message });
            }
            else {
                var document = response.data;
                document.contentType = "document";
                document.href = "/docs/DOC-" + response.data.id;
                document.subject = data.subject;

                if (template.content.includeAttachment) {
                	addAttachments(template, document, callback);
                }
                else {
                    doActions(document, callback);
                }
            }
        });
    };
    
    var addAttachments = function(template, content, callback) {
    	var dirty = false;
    	
        $j('#fbldr-dialog').html(jive.fbldr.soy.attachments({
        	variables: getHtmlVariables(content.content.text)
        })).dialog({
        	buttons: { 
        	    Finished: function() {
        		    $j(this).dialog("close");
        	    }
            },
        	closeOnEscape: false,
        	modal: true,
        	title: "Add Attachments",
        	close: function() {
            	if (dirty) {
            		content.update().execute(function(response) {
            			doActions(content, callback);
            		});
            	}
            	else {
            	    doActions(content, callback);
            	}
            }
        }); 
    	
        $j('#fbldr-attach-file').click(function() {
        	content.requestAttachmentUpload(function(attachment) {
            	if (!attachment || !attachment.id || !attachment.name || !attachment.contentType) {
            		console.log("Unable to add valid attachment:", attachment);
            		return;
            	}

            	console.log("Added attachment:", attachment);	

                if (!content.attachments) {
                	content.attachments = [];
                }
                content.attachments.push(attachment);
                
                var linkField = $j("#fbldr-attach-link");
                var linkTo = sanitizeValue(linkField);
                if (linkTo) {
                	var parsedText = parseAttachment(linkTo, content, attachment);
                	content.content.text = parsedText;
                	$j('#fbldr-attach-link').find('option[value="' + linkTo + '"]').remove();
                }
                $j(linkField).val("");
                $j('#fbldr-attach-files').append(jive.fbldr.soy.attachFile({
                	attachment: attachment,
                	linkTo: linkTo
                }));
                
                dirty = true;
            }, {
                dialogTitle: "Form Attachment",
                instructionMsg: "Select a file to attach to the content being created by the form."
            });
        });        
    };
    
    var getHtmlVariables = function(text) {
    	var variables = [];
    	
    	var varRegex = new RegExp("\\{\\$(.*?)\\.(?:link|img)\\}", "g");
    	var match;
    	
    	while (match = varRegex.exec(text)) {
    		var variable = match[1];
    		if (variables.indexOf(variable) < 0) {
    			variables.push(variable);
    		}
    	}
    	
    	return variables.sort();
    };
    
    var parseAttachment = function(linkTo, content, attachment) {    	
        var replaced = content.content.text;
        
        var config = {
            filename: attachment.name,
            attachId: attachment.id,
            docId: content.id
        };
        
        var linkRegex = new RegExp("\\{\\$" + linkTo + "\\.link\\}", "g");
        replaced = replaced.replace(linkRegex, jive.fbldr.soy.attachLink(config));

        if (attachment.contentType && attachment.contentType.indexOf('image') == 0) {
            var imgRegex = new RegExp("\\{\\$" + linkTo + "\\.img\\}", "g");
            replaced = replaced.replace(imgRegex, jive.fbldr.soy.attachImage(config));
        }
        
        return replaced;
    };
    
    var doActions = function(content, callback) {
        content.href = getBaseUrl() + content.href;
        callback({ content: content, error: null });
    };

    var getBaseUrl = function() {
        if (gadgets && gadgets.util) {
            return gadgets.util.getUrlParameters().parent;    
        }

        var baseUrl =
            window.location.protocol + '//' +
            window.location.host +
            ((window.location.port) ? ':' + window.location.port : '');
        
        return baseUrl;
    };
    
    var getContainer = function(callback) {
    	var container = {
    	    containerType: $j.getViewParam('locationType'),
    	    containerId: parseInt($j.getViewParam('locationId'))
    	};
    	
    	if (isValidContainer(container)) {
    		console.log("Got place from URL: ",  container);    		
    		callback(container);
    	}
    	else {
    		var contentType = (template.content.type == "document") ? "document" : "discussion";
    		
    		osapi.jive.core.places.requestPicker({
                success: function(response) {
    			    if (!response.data) {
    			    	callback({ error: "Invalid place selected: must be a space, project, or group." });
    			    	return;
    			    }
    		
    			    var place = response.data;
    			
    			    console.log('Got place from chooser: ', place); 
    			    
    			    var uri = place.resources.self.ref;
    			    
    			    if (uri.indexOf('/spaces/') >= 0) {
    			    	container.containerType = "space";
    			    }
    			    else if (uri.indexOf('/groups/') >= 0) {
    			        container.containerType = "group";
    		        }
    			    else {
    			        container.containerType = "project";
    		        }
    		        
    		        container.containerId = place.id;
    			    
    		        if (isValidContainer(container)) {
    		            callback(container);
    		        }
    		        else {
    		        	callback({ error: "Invalid place selected: must be a space, project, or group." })
    		        }
                },
        	    error: function(response) {
                	callback({ error: response.message });
                },
                contentType: contentType
            });
    	}
    }
    
    var isValidContainer = function(container) {
    	if (!container) {
    		return false;
    	}
    	
    	var containerType = container.containerType;
    	var containerId = container.containerId;
    	
        if (!containerType || (containerType != "group" && containerType != "project" && containerType != "space")) {
            return false;
        }
        if (isNaN(containerId) || containerId <= 0) {
            return false;
        }
        return true;
    }
            
    return {
        create: create,
        preview: preview
    };
    
}
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

jive.fbldr.FormBuilder = function(options) {

    var containerId = options.containerId;
    var container = "#" + containerId;
    
    var prefs = new gadgets.Prefs();
    
    var handleCategoryChange = function() {
        var cat = $j(this).val();
        var templates = getTemplates(cat);

        $j(this).toggleClass("fbldr-none", (!cat));
        formRenderer.clear();
        $j("#fbldr-field-ctrl-tmplts").html('')
            .removeClass("fbldr-opt-error").addClass("fbldr-none")
            .append(jive.fbldr.soy.options({ values: templates.templateValues }));
    };
    
    var handleTemplateChange = function() {
        var cat = $j("#fbldr-field-ctrl-cats").val();
        var index = $j(this).val();

        if (cat && index) {
            var templates = templateProvider.getTemplates(cat);
            var template = templates[parseInt(index)];
            renderTemplate(template);
        }
        else {
            $j(this).removeClass("fbldr-opt-error").addClass("fbldr-none");
            formRenderer.clear();
        }        
    };
    
    var renderTemplate = function(template) {
        if (!template) return;

        var hasErrors = typeof(template.errors) != "undefined";           
        $j("#fbldr-field-ctrl-tmplts").removeClass("fbldr-none").toggleClass("fbldr-opt-error", hasErrors);
        formRenderer.render(template);
    };
    
    var init = function() {
        var categories = getCategories();
        var templates = getTemplates(categories.categoryValue);
        
        if (categories.categoryValues.length == 0) {
            renderGettingStarted();
            return;
        }
                
        $j(container).addClass("fbldr-main").html('')
            .append(jive.fbldr.soy.heading({ index: 1, text: "Select a Template Form" }))
            .append(jive.fbldr.soy.select({ field: { id: "ctrl-cats", label: "Category", values: categories.categoryValues, value: categories.categoryValue } }))
            .append(jive.fbldr.soy.select({ field: { id: "ctrl-tmplts", label: "Template", values: templates.templateValues, value: templates.templateValue } }))
            .append('<div id="fbldr-container"></div>');
            
        $j("#fbldr-field-ctrl-cats").toggleClass("fbldr-none", (!categories.categoryValue)).change(handleCategoryChange);
        $j("#fbldr-field-ctrl-tmplts").toggleClass("fbldr-none", (!templates.template)).change(handleTemplateChange);
        
        renderTemplate(templates.template);
    };
    
    var renderGettingStarted = function() {
        $j(container).addClass("fbldr-main").html('')
            .append(jive.fbldr.soy.heading({ index: 1, text: "Getting Started with Forms" }))
            .append(jive.fbldr.soy.start());
    };
    
    var getCategories = function() {
        var categories = templateProvider.getCategories();
        var categoryValue = getCategoryValue(categories);
        var categoryValues = [];
        
        for (var i = 0; i < categories.length; i++) {
            var category = categories[i];
            categoryValues.push({ value: category, label: category });
            
            if (!categoryValue && (prefs.getString('fbldr_category') == category)) {
                categoryValue = category;
            }
        }
        
        return { categoryValues: categoryValues, categoryValue: categoryValue };
    };
    
    var getCategoryValue = function(categories) {
        var category = $j.getViewParam('category');
        
        for (var i = 0; i < categories.length; i++) {
            if (categories[i] == category) {
                return category;
            }
        }
        
        if (categories.length == 1) {
            return categories[0];
        }
        
        return null;
    };
    
    var getTemplates = function(cat) {
        if (!cat) return { templateValues: [], templateValue: null };
        
        var templates = templateProvider.getTemplates(cat);
        var templateMeta = getTemplateValue(templates);
        var templateIndex = templateMeta.templateIndex;
        var templateValue = templateMeta.templateValue;
        var templateValues = [];
        
        for (var i = 0; i < templates.length; i++) {
            var template = templates[i];
            var name = template.name;
            var cssClass = '';
            
            if (template.errors && template.errors.length > 0) {
                name += ' (!)';
                cssClass = 'fbldr-opt-error';
            }
            
            templateValues.push({ value: i, label: name, cssClass: cssClass });
            
            if (!templateValue && (prefs.getString('fbldr_template') == name)) {
                templateValue = template;
                templateIndex = i;
            }
        }
        
        return { templateValues: templateValues, templateValue: templateIndex, template: templateValue };
    };
    
    var getTemplateValue = function(templates) {
        var template = $j.getViewParam('template');
        
        for (var i = 0; i < templates.length; i++) {
            if (templates[i].name == template) {
                return { templateValue: templates[i], templateIndex: i };
            }
        }
        
        if (templates.length == 1) {
            return { templateValue: templates[0], templateIndex: 0 };
        }
        
        return { templateValue: null, templateIndex: -1 };
    };
    
    var templateProvider = new jive.fbldr.TemplateProvider(options, { onLoad: init });
    var formRenderer = new jive.fbldr.FormRenderer(options);
    
};
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

jive.fbldr.FormCreator = function(options) {
    
    options.preview = function(content) {
        renderContentPreview(content);
    };
    
    var rebuildDelay = 750;
    var rebuildTimeout = null;
    
    var formRenderer = new jive.fbldr.FormRenderer(options);
    
    var prefs = new gadgets.Prefs();

    var addField = function() {
        var field = {};
        
        $j('#fbldr-field-form input, #fbldr-field-form select').each(function() {
            var name = $j(this).attr('name');
            var value = null;
            
            if ($j(this).attr('type') == 'checkbox') {
                value = $j(this).is(':checked');
            }
            else {
                value = $j(this).val();
            }
            
            if (name == 'id') {
                value = value.replace(/\s+/g, '');
            }
            else if (name == 'patterns' || name == 'values') {            	
                var values = [];
                
                if (value) {
                    var parts = value.split(',');
                    
                    for (var i = 0; i < parts.length; i++) {
                        values.push($j.trim(parts[i]));
                    }
                }

                value = values;
            }
            
            // Do not assign an empty array if nothing was specified
        	if (!value || value.length == 0) {
        		return;
        	}   

            field[name] = value;
        });
        
        var fieldError = false;
        
        $j('#fbldr-fields input[type="hidden"]').each(function() {
            var value = $j(this).val();
            var otherField = JSON.parse(value);
            if (field.id == otherField.id) {
                $j('#fbldr-create-error-box').find('span.message').html("Error: '" + field.id + "' is aleady defined.");
                $j('#fbldr-create-error-box').show();
                fieldError = true;
            }
        });
        
        if (fieldError) {
            return false;
        }
        
        $j('#fbldr-fields').append(jive.fbldr.create.soy.field({
            field: field,
            json: JSON.stringify(field)
        }));
        
        $j('#jive-create-error-box').hide();
        $j('#fbldr-field-form').get(0).reset();
        
        return true;
    };
    
    var buildCreateForm = function() {
        $j('#fbldr-create-form')
            .append(jive.fbldr.soy.text({
                field : { id: 'fbldr-form-category', label: 'Category', name: 'category', required: true, value: 'My Category',
            	    title: 'The category of the template, under which the template will appear under when selecting from the list of available templates in the app.' }
            }))
            .append(jive.fbldr.soy.text({
                field : { id: 'fbldr-form-name', label: 'Name', name: 'name', required: true, value: 'My Template',
            	    title: 'The name of the template, which again will appear when selecting the template from the list of available templates in the app.' }
            }))
            .append(jive.fbldr.soy.text({
                field : { id: 'fbldr-form-desc', label: 'Description', name: 'desc', required: true, value: 'My Template Description',
            	    title: 'A more verbose description of the template, and its intended use / purpose.  This will display above the template form, once the template is selected in the app.' }
            }))
            .append(jive.fbldr.soy.select({
                field : { id: 'fbldr-form-type', label: 'Content Type', name: 'content.type', required: true, value: 'document',
            	    title: 'What type of content to create (Document, Discussion, etc.) when using the template to post from the home / canvas app view.',
                    values : [ { value: 'document', label: 'Document' }, { value: 'discussion', label: 'Discussion' }, { value: 'question', label: 'Question' } ]
                }
            }))
            .append(jive.fbldr.soy.checkbox({
                field : { id: 'fbldr-form-attach', label: 'Attachments', name: 'content.includeAttachment',
            	    title: 'If checked, the user will be allowed to add file and image attachments to the piece of content, after the form has been successfully posted to Jive.' }
            }))
            .append(jive.fbldr.soy.divider(
            ))
            .append(jive.fbldr.soy.radio({
                field : { id: 'fbldr-form-body-type', label: 'HTML Source', name: 'form.contentSource', value: 'document',
                    values : [ { value: 'document', label: 'Another Jive Document' }, { value: 'template', label: 'Within This Template' } ]
                }
            }))
            .append(jive.fbldr.soy.text({
                field : { id: 'fbldr-form-doc-id', label: 'HTML Doc ID', name: 'content.docId', required: true, value: "0" }
            }))
            .append(jive.fbldr.soy.text({
                field : { id: 'fbldr-form-title', label: 'HMTL Title', name: 'content.title', required: true }
            }))
            .append(jive.fbldr.soy.text({
                field : { id: 'fbldr-form-body', label: 'HTML Body', name: 'content.body', required: true }
            }));
        
        renderContentSource();
    };
    
    var buildFieldForm = function() {
        $j('#fbldr-field-form')
            .append(jive.fbldr.soy.text({
                field : { id: 'fbldr-field-id', label: 'ID', name: 'id', required: true,
            	    title: 'The unique identifier for the field.  All whitespace will be removed from the ID field, and only alphanumeric, "-", and "_" characters should be used.' }
            }))
            .append(jive.fbldr.soy.text({
                field : { id: 'fbldr-field-label', label: 'Label', name: 'label', required: true,
            	    title: 'The user-friendly label for the field, which will show next to the field when rendered in the form.' }
            }))
            .append(jive.fbldr.soy.select({
                field : { id: 'fbldr-field-type', label: 'Type', name: 'type', required: true, value: 'text',
            	    title: 'The data / UI entry type of the field, Text Field, Date, etc.',
                    values : [ { value: 'text', label: 'Text Field'}, { value: 'textarea', label: 'Text Area' },
                               { value: 'boolean', label: 'Checkbox' }, { value: 'date', label: 'Date Field' },
                               { value: 'select', label: 'Select Option' }, { value: 'userpicker', label: 'User Picker' } ]
                }
            }))
            .append(jive.fbldr.soy.text({
                field : { id: 'fbldr-field-values', label: 'Values', name: 'values', required: true,
            	    title: 'Options to choose from the select list.  Enter as comma-delimited list (e.g. value1, value2, value3)' }
            }))
            .append(jive.fbldr.soy.text({
                field : { id: 'fbldr-field-value', label: 'Default Value', name: 'value',
            	    title: 'For text fields, and select fields, provides the default value that will be placed in the form when it first loads (does not apply to all field types)' }
            }))
            .append(jive.fbldr.soy.text({
                field : { id: 'fbldr-field-title', label: 'Tooltip', name: 'title',
            	    title: 'A more verbose, descriptive text describing the use or format of the field, which is displayed when the user hovers over the "i" info icon to the right of the form field.' }
            }))
            .append(jive.fbldr.soy.checkbox({
                field : { id: 'fbldr-field-required', label: 'Required', name: 'required',
            	    title: 'If checked, the user will be required to provide a value for this form field, and will not be allowed to submit the form successfully until a value is provided.' }
            }))
            .append(jive.fbldr.soy.text({
                field : { id: 'fbldr-field-patterns', label: 'Patterns', name: 'patterns',
            	    title: 'A list of regular expressions which can be used to validate the value entered for the field.  Enter as comma-delimited list (e.g. pattern1, pattern2, pattern3)' }
            }))
            .append(jive.fbldr.soy.text({
                field : { id: 'fbldr-field-pattern-error', label: 'Pattern Error', name: 'patternError',
            	    title: 'A more user-friendly, human readable error to display when a regular expression is provided for validation and the value does not match.' }
            }))
            .append(jive.fbldr.create.soy.addField())
            .append(jive.fbldr.soy.divider(
            ));
        
        renderFieldValues();
    };
    
    var buildEmptyTemplate = function() {
        return {
            category : "",
            name : "",
            desc : "",
            fields : [],
            content : {
                type : "",
                docId : "",
                title : "",
                body : "",
                includeAttachment : false
            }
        };
    };
    
    var handleFormInputs = function() {
        $j('#fbldr-create-form input').keyup(function(event) {
            if (event.which != 9 && event.which != 13) {
                clearTimeout(rebuildTimeout);
                rebuildTimeout = setTimeout(rebuildViews, rebuildDelay);
            }
            return true;
        });
        
        $j('#fbldr-create-form input[type="checkbox"],#fbldr-create-form select').change(function() {
            rebuildViews();
            return true;
        });
        
        $j('#fbldr-create-form input[type="radio"]').change(renderContentSource);        
    };
    
    var handleFieldInputs = function() {
        $j('#fbldr-field-form select[name="type"]').change(renderFieldValues);
        
        $j('#fbldr-field-add').click(function() {
            if (addField()) {
                rebuildViews();
            }
        });
        
        $j('#fbldr-fields').on('click', 'a.fbldr-field-del', function() {
            $j(this).closest('li').remove();
            rebuildViews();
            return false;
        });
        
        $j('#fbldr-fields').on('click', 'a.fbldr-field-down', function() {
            var listItem = $j(this).closest('li');
            var index = listItem.index();
            var last = $j('#fbldr-fields').children('li').length - 1;
            
            if (index != last) {
                listItem.next().after(listItem);
                rebuildViews();    
            }
            
            return false;
        });

        $j('#fbldr-fields').on('click', 'a.fbldr-field-up', function() {
            var listItem = $j(this).closest('li');
            var index = listItem.index();
            
            if (index != 0) {
                listItem.prev().before(listItem);
                rebuildViews();    
            }
            
            return false;
        });
    };
    
    var rebuildViews = function() {
        var data = rebuildTemplate();
        rebuildPreview(data);
        rebuildSource(data);                
    };
    
    var rebuildTemplate = function() {
        var template = buildEmptyTemplate();
        
        $j('#fbldr-create-form input,#fbldr-create-form select').each(function() {
            var names = $j(this).attr('name').split('.');
            
            if (names[0] == 'form') {
                return;
            }
            
            var value = null;
            
            if ($j(this).attr('type') == 'checkbox') {
                value = $j(this).is(':checked');
            }
            else {
                value = $j(this).val();
            }
            
            var obj = template;
            for (var i = 0; i < names.length - 1; i++) {
                obj = obj[names[i]];
            }
            
            if ($j(this).is(':disabled')) {
                delete obj[names[names.length - 1]];
            }
            else {
                obj[names[names.length - 1]] = value;
            }
        });
        
        $j('#fbldr-fields input[type="hidden"]').each(function() {
            var value = $j(this).val();
            var field = JSON.parse(value);
            template['fields'].push(field);
        });
        
        return template;
    };
    
    var rebuildPreview = function(data) {
        new jive.fbldr.TemplateValidator(data, function() {
            formRenderer.render(data);
        });
    };
    
    var rebuildSource = function(data) {
        var json = JSON.stringify(data, null, 4);
        json = $j('<div />').text(json).html();
        var source = '<pre>\n' + json + '\n</pre>\n';
        $j('#fbldr-create-text').val(source);    
    };
    
    var renderContentPreview = function(content) {
        $j('#fbldr-content-preview-head').html('Title : ' + content.title);
        $j('#fbldr-content-preview-container').html(content.body);
        
        $j('#fbldr-create-views').tabs( "option", "disabled", [] );
        $j('#fbldr-create-views').tabs( "option", "selected", 2 );
    };
    
    var renderContentSource = function() {
        var value = $j('#fbldr-create-form input[type="radio"]:checked').val();
        var showDoc = (value == 'document');

        $j('#fbldr-field-fbldr-form-doc-id').attr('disabled', showDoc ? null : 'disabled');
        $j('#fbldr-field-fbldr-form-title').attr('disabled', showDoc ? 'disabled' : null);
        $j('#fbldr-field-fbldr-form-body').attr('disabled', showDoc ? 'disabled' : null);
        
        $j('#fbldr-field-fbldr-form-doc-id').closest('div.fbldr-field').toggle(showDoc);
        $j('#fbldr-field-fbldr-form-title').closest('div.fbldr-field').toggle(!showDoc);
        $j('#fbldr-field-fbldr-form-body').closest('div.fbldr-field').toggle(!showDoc);
        
        rebuildViews();
    };

    var renderFieldValues = function() {
        var value = $j('#fbldr-field-form select[name="type"]').val();
        var showValues = (value == 'select');

        $j('#fbldr-field-fbldr-field-values').attr('disabled', showValues ? null : 'disabled');
        $j('#fbldr-field-fbldr-field-values').closest('div.fbldr-field').toggle(showValues);
    };
    
    var renderPreviewHeader = function() {
        $j('#fbldr-create-preview-head')
        .append(jive.fbldr.soy.heading({ index: 1, text: "Enter Template and Field Information" }))
        .append(jive.fbldr.create.soy.headingText());
    };
    
    var init = function() {
        renderPreviewHeader();

        buildCreateForm();
        buildFieldForm();
        
        handleFormInputs();
        handleFieldInputs();
        rebuildViews();        
        
        $j('#fbldr-menu-create').hide();
        $j('#fbldr-menu-help').show();
        $j('#fbldr-menu-forms').show();
        
        $j('#fbldr-create-views').tabs({ disabled: [ 2 ] });
        $j('#fbldr-create-controls').tabs();
        
        $j('#fbldr-menu').fadeIn();
        $j("#fbldr-create").fadeIn();
    };
    
    init();
    
};
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

jive.fbldr.FormHelp = function(options) {
     
    var prefs = new gadgets.Prefs();
    
    var init = function() {
        $j('#fbldr-menu-create').show();
        $j('#fbldr-menu-help').hide();
        $j('#fbldr-menu-forms').show();
        
        $j('#fbldr-help').tabs();
        
        $j('#fbldr-menu').fadeIn();
        $j("#fbldr-help").fadeIn();
    };
 
    init();
    
};
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

jive.fbldr.FormRenderer = function(options) {
    
    var containerId = "fbldr-container";
    var container = "#" + containerId;
    var formId = "fbldr-form";
    var form = "#" + formId;
    
    var delay = 500;
    
    var prefs = new gadgets.Prefs();
    
    var clear = function(callback, params) {
        $j(container).fadeOut(delay, function() {
            $j('#fbldr-submit-status').toggleClass('fbldr-submit-error', false).html('').hide();
            $j(this).html('');
            if (!callback) callback = handleResize;
            callback(params);
        });
    };
    
    var render = function(template) {
        if (!template) return;
        
        var callback = (template.errors) ? showErrors : createForm;
        clear(callback, { template: template });
    };

    var showErrors = function(params) {
        var template = params.template;
        
        $j(container)
            .append(jive.fbldr.soy.heading({ index: 2, text: "Address Template Errors" }))
            .append(jive.fbldr.soy.validationErrors({ errors: template.errors }))
            .fadeIn(delay, handleResize);
    };
    
    var createForm = function(params) {
        var template = params.template;
    
        $j(container)
            .append(jive.fbldr.soy.heading({ index: 2, text: "Fill Out Template Form" }))
            .append(jive.fbldr.soy.header({ name: template.name, desc: template.desc }))
            .append(jive.fbldr.soy.form({ id: formId }));

        for (var i = 0; i < template.fields.length; i++) {
            renderField(template.fields[i]);
        }
        
        $j(form)
            .append(jive.fbldr.soy.notes({ 
            	includeAttachment: (template.content.type == 'document' && template.content.includeAttachment)
            }))
            .append(jive.fbldr.soy.heading({ index: 3, text: "Submit Template Form" }))
            .append(jive.fbldr.soy.submit({ label: getSubmitLabel(template) }));
        
        handleSubmit(template);
        
        $j(container).fadeIn(delay, handleResize);
    };
    
    var getSubmitLabel = function(template) {
       var contentType = template.content.type;
       var label = "Submit Form";

       if (jive.fbldr.isEmbedded()) {
           label = "Insert Form Content"; 
       }
       else if (contentType == "doc" || contentType == "document") {
           label = "Create Document";
       }
       else if (contentType == "discussion" || contentType == "thread") {
           label = "Post Discussion";
       }
       else if (contentType == "question") {
           label = "Post Question";
       }
       
       return label;
    };
    
    var handleResize = function() {
        if (typeof(gadgets) != "undefined") {
            // gadgets.window.adjustHeight();
        }
    };
    
    var handleSubmit = function(template) {
        $j("#fbldr-submit-btn").click(function() {
            var form = $j(this).closest("form");
            var valid = new jive.fbldr.FormValidator(template,form).isValid();
            if (valid) {
                if (options.preview) {
                    renderStatus('submit');
                    
                    var creator = new jive.fbldr.ContentCreator(template, form);
                    var content = creator.preview();
                    
                    setTimeout(function() {
                        renderStatus('success', null);
                        options.preview(content);
                    }, delay);
                }
                else {
                    renderStatus('submit');
                    var creator = new jive.fbldr.ContentCreator(template, form);
                    creator.create(handleCreated);
                }
            }
            else {
                renderStatus('error');
            }
        });
    };
    
    var handleCreated = function(response) {
        if (response.error) {
            var msg = 'Error creating content: ' + response.error;
            jive.fbldr.errorMessage(msg);
            console.log(msg);
            renderStatus('failure');
        }
        else {
            var msg = 'Succesfully created ' + response.content.contentType + ': ' + response.content.subject;
            // jive.fbldr.successMessage(msg);
            // console.log(msg);            
            renderStatus('success', response.content);
        }
    };
    
    var renderField = function(field) {
        if (field.type == "boolean") {
            $j(form).append(jive.fbldr.soy.checkbox({ field: field }));
        }
        else if (field.type == "date") {
            $j(form).append(jive.fbldr.soy.text({ field: field }));
            $j("#fbldr-field-" + field.id).datepicker({
                showOn: "both",
                buttonImage: $j("#fbldr-cal-icon").attr("src"),
                buttonImageOnly: true
            });
        }
        else if (field.type == "select" || field.type == "userselect") {
            $j(form).append(jive.fbldr.soy.select({ field: field }));
            $j("#fbldr-field-" + field.id).toggleClass("fbldr-none", !$j("#fbldr-field-" + field.id).val()).change(function() {
                $j(this).toggleClass('fbldr-none', !$j(this).val());
            });
        }
        else if (field.type == "text") {
            $j(form).append(jive.fbldr.soy.text({ field: field }));
        }
        else if (field.type == "textarea") {
            $j(form).append(jive.fbldr.soy.textarea({ field: field }));
        }
        else if (field.type == "userpicker") {
            var options = { field: field, multiple: true };
            $j(form).append(jive.fbldr.soy.userpicker(options));
            var userpicker = new jive.fbldr.UserPicker(options);
        }
        else {
            console.log("Unhandled field type: " + field.type + " (" + field.id + ")");
        }
    };
    
    var renderStatus = function(status, content) {
        var isError = (status == 'error' || status == 'failure');
        $j('#fbldr-submit-status').toggleClass('fbldr-submit-error', isError);
        
        var statusOptions = { statusHtml: 'Status unknown', iconCss: 'jive-icon-redalert' };
        
        if (status == 'error') {
            statusOptions.statusHtml = 'Form contains errors.';
        }
        else if (status == 'failure') {
            statusOptions.statusHtml = 'Error creating content.';
        }
        else if (status == 'submit') {
            statusOptions.statusHtml = 'Creating content...';
            statusOptions.iconCss = 'fbldr-submit-load';
            statusOptions.iconSrc = $j('#fbldr-load-icon').attr('src');
        }
        else if (status == 'success') {
            statusOptions.iconCss = 'jive-icon-check';
            
            var text = (options.preview) ? 'Form preview success.' : 'New content created.';
            
            if (content) {
                statusOptions.statusHtml = jive.fbldr.soy.submitSuccess({ content: content, text: text });
                if (content.href && isRedirect()) {
                    setTimeout(function() {
                        window.parent.location = content.href;
                    }, delay);
                }
            }
            else {
                statusOptions.statusHtml = text;
            }
        }
        
        $j('#fbldr-submit-status').html(jive.fbldr.soy.submitStatus(statusOptions)).show();
    };
    
    var isRedirect = function() {
        var urlRedirect = ($j.getViewParam("redirect") == "true");
        var prefRedirect = prefs.getBool("fbldr_redirect"); 
        return ( urlRedirect || prefRedirect );
    };
    
    return {
        clear: clear,
        render: render
    };
    
};
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

jive.fbldr.FormValidator = function(template, form) {
    
    var isValid = function() {
        var hasError = false;
        
        for (var tIdx = 0; tIdx < template.fields.length; tIdx++) {
            var fieldError = false;
            var field = template.fields[tIdx];
            var value = getFieldValue(field);
            
            if (field.required && !value) {
                displayError(field, "'" + field.label + "' is a required field");
                fieldError = true;
            }
            else if (value && value.length > 0 && field.patterns && field.patterns.length > 0) {
                var matches = false;
                for (var pIdx = 0; pIdx < field.patterns.length; pIdx++) {
                    var pattern = field.patterns[pIdx];
                    if (value.match(new RegExp(pattern))) {
                        matches = true;
                        break;
                    }
                }
                
                if (!matches) {
                    var msg = getErrorMessage(field);
                    displayError(field, msg);
                    fieldError = true;
                }
            }
            
            if (fieldError) {
                hasError = true;
            }
            else {
                clearError(field);
            }
        }
        
        return !hasError;
    };
    
    var getErrorMessage = function(field) {
        var msg = "'" + field.label + "' does not match "
        
        if (field.patternError) {
            msg += field.patternError;
        }
        else if (field.patterns.length == 1) {
            msg += "the specified pattern '" + field.patterns[0] + "'";
        }
        else {
            msg += "any of the specified patterns";
        }
        
        return msg;
    }
    
    var clearError = function(field) {
        getErrorElement(field).attr("title", "").hide();
        getFieldElement(field).toggleClass("fbldr-input-error", false);        
    };
    
    var displayError = function(field, msg) {
        getErrorElement(field).attr("title", msg).show();
        getFieldElement(field).toggleClass("fbldr-input-error", true);
    };

    var getErrorElement = function(field) {
        return $j(form).find("#fbldr-error-" + field.id);
    };
    
    var getFieldElement = function(field) {
        return $j(form).find("#fbldr-field-" + field.id);
    };
    
    var getFieldValue = function(field) {
        if (field.type == "userpicker") {
            var userIds = new Array();
            var users = getFieldElement(field).find('li');
            for (var i = 0; i < users.length; i++) {
                var id = $j(users[i]).attr('userid');
                if (id)
                    userIds.push(id);
            }
            return (userIds.length > 0) ? userIds : null;
        }
        else {
            var value = getFieldElement(field).val();
            return (value) ? $j.trim(value) : "";
        }
    };
            
    return {
        isValid: isValid
    };
    
}
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

jive.fbldr.TemplateProvider = function(options, handlers) {

    var categories = [];
    var templateMap = {};
    
    var getCategories = function() {
        return categories;
    };
    
    var getTemplates = function(category) {
        return templateMap[category];
    };

    var categorizeTemplates = function(templates) {      
        categories = [];
        templateMap = {};
        
        for (var i = 0; i < templates.length; i++) {
            var template = templates[i];
            var category = templateMap[template.category];
            
            if (typeof(category) == "undefined") {
                templateMap[template.category] = [];
                category = templateMap[template.category];
                categories.push(template.category);
            }
            category.push(template);
        }
        
        categories.sort();
        
        for (var i = 0; i < templateMap.length; i++) {
            templateMap[i].sort(templateComparator);
        }
        
        if (handlers.onLoad) {
            handlers.onLoad();
        }
    };
    
    var templateComparator = function(t1, t2) {
        if (t1.name > t2.name) {
            return 1;
        }
        else if (t1.name < t2.name) {
            return -1;
        }
        else {
            return 0;
        }
    };

    var init = function() {
        var sourceOptions = options;
        
        sourceOptions.onLoad = function(templates) {
            categorizeTemplates(templates);
        };
        
    	new jive.fbldr.JiveTemplateSource(sourceOptions).loadTemplates();
    };
        
    init();
    
    return {
        getCategories: getCategories,
        getTemplates: getTemplates
    };
    
};/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

jive.fbldr.JiveTemplateSource = function(options) {
    
    var infoId = options.infoId;
    var info = "#" + infoId;
    var loadId = "fbldr-load";
    var load = "#" + loadId;
    var menuId = "fbldr-menu";
    var menu = "#" + menuId;
    var progId = "fbldr-load-progress";
    var prog = "#" + progId;
    
    var onLoad = options.onLoad;
    
    var prefs = new gadgets.Prefs();
    
    var templates = [];
    var docsFound = 0;
    var docsLoaded = 0;

    var loadTemplates = function() {
        templates = [];
        docsFound = 0;
        docsLoaded = 0;
        
        showLoading();
        updateProgress(0);
        searchDocuments();
	};
	
	var searchDocuments = function() {
	    var docs = prefs.getString('fbldr_docs').replace(/\s+/g, '').replace(/DOC-/gi, '').split(",");
        var tags = prefs.getString('fbldr_tags').replace(/\s*,\s*/g, ' OR ');
        
        var request = osapi.jive.core.searches.searchContent({query: tags, limit: 100, type: ['document']});
        request.execute(function(response) {
            var results = response.data || [];
            
            for (var i = 0; i < results.length; i++) {
                var doc = results[i];
                var docRef = doc.resources.self.ref; 
                var docId = docRef.substring(docRef.lastIndexOf("/") + 1);
                
                if ($j.inArray(docId, docs) < 0) {
                    docs.push(docId);
                }
            }
            
            getDocuments(docs);
        });
	};
	
	var checkComplete = function(forceComplete) {
	    if (!forceComplete && (docsFound != docsLoaded)) {
	        return;
	    }
	    
	    if (forceComplete) {
	        updateProgress(100);
	    }
	    
	    // Let the progress bar sit full for a brief moment
        setTimeout(complete, 250);
	};
	
	var complete = function() {
        hideLoading();
        showMenu();
        
        if (onLoad) {
            onLoad(templates);
        }
        else {
            console.log('Error: no onLoad callback specified for template source');
        }
	}
	
    var docLoaded = function(forceLoad) {
        docsLoaded++;
        updateProgress(Math.round(docsLoaded / docsFound * 100));
        checkComplete();
    };
	
	var getDocuments = function(docs) {
		docsFound = docs.length;
		
		if (docsFound == 0) {
		    checkComplete(true);
		    return;
		}

		for (var docIndex = 0; docIndex < docs.length; docIndex++) {
			var docId = docs[docIndex];

			var request = osapi.jive.core.documents.get({id: docId});
			request.execute(function(response) {
			    if (!response.data) {
			        docLoaded();
			        return;
			    }

			    var document = response.data;
                var text = $j("<div/>").html(document.content.text).html()
                text = text.replace(/\n/g,'').replace(/&nbsp;/g,' ');
                
                var regex = /<pre.*?>(.*?)<\/pre>/gi;
                var match = regex.exec(text);
                
                // if no template content, we're done with this doc
                if (match == null) {
                    docLoaded();
                    return;
                }
                
                var matches = [];
                
                while (match != null) {
                    matches.push(match[1]);
                    match = regex.exec(text);
                }
                
                parseTemplates(matches, document.subject);
			});
		}
	};
	
	var parseTemplates = function(unparsedTemplates, defaultCategory) {
	    var parsedTemplates = [];
	    
	    var handleParsedTemplate = function(template) {
	        parsedTemplates.push(template);
	        if (parsedTemplates.length == unparsedTemplates.length) {
	            handledParsedTemplates(parsedTemplates);
	        }
	    };
	    
	    for (var i = 0; i < unparsedTemplates.length; i++) {
	        parseTemplate(unparsedTemplates[i], defaultCategory, handleParsedTemplate);
	    }
	};
	
	var parseTemplate = function(text, defaultCategory, callback) {
	    var template = null;
        
        try {
            text = $j("<div/>").html(text).text();
            template = $j.parseJSON(text);
            template.defaultCategory = defaultCategory;

            var validator = new jive.fbldr.TemplateValidator(template, function() {
                callback(template);
            });
        }
        catch (error) {
        	if (!template) {
        		template = {};
        	}
        	
            var msg = 'Error validating template: ' + error.message + '\n' + text;
            console.log(msg);
            template.errors = [ msg ];
            callback(template);
        }  
	}
	
	var handledParsedTemplates = function(parsedTemplates) {
	    for (var i = 0; i < parsedTemplates.length; i++) {
	        templates.push(parsedTemplates[i]);
	    }
        docLoaded();
	};
	
	var getLoading = function() {
	    var loading = $j(info).find(load);
	    if (loading.length == 0) {
	        loading = $j(info).append(jive.fbldr.soy.load()).find(load);
	    }
	    return loading;
	};
	
	var updateProgress = function(value) {
	    var $progressbar = $j(info).find(prog);
	    $progressbar.find('.fbldr-progress-text').html( value + '%');
	    return $progressbar.progressbar({value : value});
	};
	
	var hideLoading = function() {
	    getLoading().hide();
	};
	
	var showLoading = function() {
	    getLoading().show();
	};
	
	var showMenu = function() {
        $j(menu + '-create').show();
        $j(menu + '-help').show();
        $j(menu + '-forms').hide();
	    
	    $j(menu).fadeIn();
	};
	
	return {
		loadTemplates: loadTemplates
	};
};

jive.fbldr.FakeTemplateSource = function(options) {
    
    var onLoad = options.onLoad;
    
    var abcTemplate = {
        "category": "My Templates",
        "name": "ABC Template",
        "desc": "This is a template that I use to record stuff.",
        "fields": [
            { "type": "userpicker", "id": "who", "label": "Who", "required": true },
            { "type": "text", "id": "what", "label": "What", "value": "this is what" },
            { "type": "text", "id": "why", "label": "Why", "value": "this is why" },
            { "type": "text", "id": "where", "label": "Where", "value": "this is where" },
            { "type": "date", "id": "when", "label": "When", "title": "Pick a date, any date." },
            { "type": "textarea", "id": "how", "label": "How", "value": "this is how" },
            { "type": "text", "id": "quantity", "label": "How Many", "value": "this is how many", "title": "Must be a number", "patterns": ["\\d+"] },
            { "type": "boolean", "id": "like", "label": "Like", "value": true }
        ],
        "content": {
            "type": "document",
            "title": "A {$what} is Happening",
            "body": "&lt;body&gt;&lt;div&gt;&lt;h4&gt;For&lt;/h4&gt;{$who}&lt;/div&gt;&lt;div&gt;&lt;h4&gt;{$why.label}&lt;/h4&gt;&lt;span&gt;{$why}&lt;/span&gt;&lt;/div&gt;&lt;div&gt;&lt;h4&gt;{$where.label}&lt;/h4&gt;&lt;span&gt;{$where}&lt;/span&gt;&lt;/div&gt;&lt;div&gt;&lt;h4&gt;{$when.label}&lt;/h4&gt;&lt;span&gt;{$when}&lt;/span&gt;&lt;/div&gt;&lt;div&gt;&lt;h4&gt;{$how.label}&lt;/h4&gt;&lt;span&gt;{$how}&lt;/span&gt;&lt;/div&gt;&lt;div&gt;&lt;h4&gt;Liked?&lt;/h4&gt;&lt;span&gt;{$like}&lt;/span&gt;&lt;/div&gt;&lt;/body&gt;"
        }
    };

    var myTemplate = {
        "category": "My Templates",
        "name": "A Template",
        "desc": "This is a template that I use to do stuff.",
        "fields": [
            { "type": "text", "id": "firstName", "label": "First Name", "required": true },
            { "type": "text", "id": "lastName", "label": "Last Name", "required": true },
            { "type": "text", "id": "email", "label": "Email" },
            { "type": "text", "id": "phone", "label": "Phone" },
            { "type": "text", "id": "ipaddr", "label": "IP Address", "title": "A valid IP address (ex: 192.168.1.1)", "patterns": ["\\d{1,4}\\.\\d{1,4}\\.\\d{1,4}\\.\\d{1,4}"], "patternError": "valid IP address" },
            { "type": "select", "id": "contact", "label": "Best Contact", "values": [{"value":"immediately","label":"Now"}, {"value":"soon","label":"Later"},{"value":"future","label":"Never"}], "value": "future" },
            { "type": "textarea", "id": "notes", "label": "Notes" }
        ],
        "content": {
            "type": "discussion",
            "title": "A Discussion Title",
            "body": "&lt;body&gt;Discussion Body&lt;/body&gt;"
        }
    };

    var yourTemplate = {
        "category": "Your Templates",
        "name": "Message Template",
        "desc": "This is a template that I use to message stuff.",
        "fields": [
            { "type": "text", "id": "msgTo", "label": "To", "required": true, "title": "Who are you sending this to?" },
            { "type": "text", "id": "msgFrom", "label": "From", "required": true, "title": "This should be you." },
            { "type": "userselect", "id": "msgCopy", "label": "CC", "required": true, "values": [{"value":"3218,3378","label":"Developers"},{"value":"3218","label":"Fernando"},{"value":"3378","label":"Monte"}] },
            { "type": "text", "id": "msgSubj", "label": "Subject", "required": true, "title": "What is this regarding?" },
            { "type": "textarea", "id": "msgBody", "label": "Message", "title": "This is the body of your message." },
            { "type": "select", "id": "msgSend", "label": "Send Via", "values": ["Email", "IM", "Text"], "required": true  }
        ],
        "content": {
            "type": "question",
            "title": "A Question",
            "body": "&lt;body&gt;Question Body&lt;/body&gt;"
        }
    };
    
    var errorTemplate = {
        "category": "Your Templates",
        "name": "Error Template",
        "fields": [
            { "type": "invalid", "id": "invalidType", "label": "Invalid Type" },
            { "id": "missingType", "label": "Missing Type" },
            { "type": "text", "label": "Missing ID" },
            { "type": "text", "id": "missingLabel" }
        ],
        "content": {
        }
    };
    
    var loadTemplates = function() {
        if (onLoad) {
            onLoad([ abcTemplate, myTemplate, yourTemplate, errorTemplate ]);
        }
        else {
            console.log('Error: no onLoad callback specified for template source');
        }
    };
    
    return {
        loadTemplates: loadTemplates 
    };
    
};
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

jive.fbldr.TemplateValidator = function(template, onLoad) {
    
    var structure = {
        template: {
            required: ['category','name','desc','fields','content'],
            optional: ['defaultCategory']
        },
        field: {
            required: ['type','id','label'],
            optional: ['required','patterns','patternError','title','value','values']
        },
        value: {
            required: ['value','label'],
            optional: []
        },
        content: {
            required: ['type'],
            optional: ['docId','title','body','includeAttachment']
        },
        contentBody: {
            required: ['type','title','body'],
            optional: ['includeAttachment']
        }
    };
    
    var validContentTypes = ['document', 'discussion', 'question'];
    var validFieldTypes = ['boolean', 'date', 'select', 'text', 'textarea', 'userpicker', 'userselect'];
    
    var self = this;
    
    var valid = false;
    var errors = [];
    
    var isValid = function() {
        return errors.length == 0;
    };
    
    var getValidationErrors = function() {
        return errors;
    };
    
    var init = function() {
        validateTemplate();
        validateFields();
        validateContent();        
    };
    
    var validateTemplate = function() {
        if (!template.category && template.defaultCategory) {
            template.category = template.defaultCategory;
        }
        validateStructure(template, 'template');
    };
    
    var validateFields = function() {
        if (!template.fields) return;
        
        var fields = template.fields;
        if (!$j.isArray(fields)) {
            var objType = Object.prototype.toString.call(fields);
            errors.push("Expected array of fields but found '" + objType + "' instead");
            return;
        }
        else if (fields.length == 0) {
            errors.push("No fields are defined for template, at least one is required");
            return;
        }
        
        for (var i = 0; i < fields.length; i++) {
            var field = fields[i];
            validateStructure(field, 'field');
            validateFieldType(field);
            normalizeRequired(field);
            validatePatterns(field);
            normalizeValues(field);
        }
    };
    
    var validateFieldType = function(field) {
        if (!field.type) return;
        
        var type = field.type;
        
        if ($j.inArray(type, validFieldTypes) < 0) {
            errors.push("Invalid field type '" + type + "' specified for field '" + field.id + "'");
        }
    };
    
    var normalizeRequired = function(field) {
        field.required = field.required
            && (field.required == true || field.required == "true");
    };
    
    var validatePatterns = function(field) {
        if (!field.patterns) return;
        
        if (!$j.isArray(field.patterns)) {
            var objType = Object.prototype.toString.call(values);
            errors.push("Expected array of string patterns but found '" + objType + "' instead");
            return;
        }
    }
    
    var normalizeValues = function(field) {
        if  (!field.values) return;
        
        var values = field.values;
        if (!$j.isArray(values)) {
            var objType = Object.prototype.toString.call(values);
            errors.push("Expected array of values but found '" + objType + "' instead");
            return;
        }
        
        var normalized = [];
        
        for (var i = 0; i < values.length; i++) {
            var value = values[i];
            if (typeof(value) == "object") {
                validateStructure(value, 'value');
                normalized.push(value);
            }
            else {
                normalized.push({ value: value, label: value });
            }
        }

        field.values = normalized;
    };
    
    var validateContent = function() {
        if (!template.content) return;
        
        validateStructure(template.content, 'content');
        normalizeAttachment();
        validateContentBody();
    };
    
    var normalizeAttachment = function() {
        template.content.includeAttachment = template.content.includeAttachment
            && (template.content.includeAttachment == true || template.content.includeAttachment == "true");
    };

    var validateContentBody = function() {
        if (!template.content.docId) {
            validateStructure(template.content, 'contentBody');
            normalizeBody();
            finalizeValidation();
        }
        else {
            var id = parseInt(template.content.docId);
            
            if (isNaN(id) || id <= 0) {
                errors.push("Unable to load template content body from doc ID '" + template.content.docId + "'");
                finalizeValidation();
            }
            else {
                loadContentBody();
            }
        }
    };
    
    var normalizeBody = function() {
        if (!template.content.body) return;
        
        template.content.body = template.content.body.replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    };
    
    var finalizeValidation = function() {
        validateContentType();
        
        if (!isValid()) {
            template.errors = getValidationErrors(); 
        }
        
        onLoad();
    }
    
    var loadContentBody = function() {
        var request = osapi.jive.core.documents.get({id: template.content.docId});
        request.execute(function(response) {
            if (!response.data) {
                errors.push("Unable to load template content body from doc ID '" + template.content.docId + "'");
            }
            else {
                var document = response.data;
                // Escaping the HTML this way is broken in IE, do NOT do this, just use the raw content
                // template.content.title = $j("<div/>").html(document.subject).html();
                // template.content.body = $j("<div/>").html(document.content.text).html();
                template.content.title = document.subject;
                template.content.body = document.content.text;
            }
            
            finalizeValidation();
        });
    };
        
    var validateContentType = function() {
        if (!template.content.type) return;
        
        var type = template.content.type;
        
        if ($j.inArray(type, validContentTypes) < 0) {
            errors.push("Invalid content type '" + type + "' specified");
        }
    };
    
    var validateStructure = function(object, parent) {
        var required = structure[parent].required;
        var optional = required.concat(structure[parent].optional);
        
        for (var i = 0; i < required.length; i++) {
            var child = required[i];
            if (!object[child]) {
                var msg = "Required value of '" + child + "' missing for " + parent;
                if (object.id) {
                    msg += " '" + object.id + "'";
                }
                errors.push(msg);
            }
        }
        
        for (var child in object) {
            if ($j.inArray(child, optional) < 0) {
                var msg = "Warning: unexpected value of '" + child + "' found for " + parent;
                if (object.id) {
                    msg += " '" + object.id + "'";
                }
                console.log(msg);
            }
        }
    };
    
    init();
    
    return {
        isValid: isValid,
        getValidationErrors: getValidationErrors
    }
}/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

jive.fbldr.UserPicker = function(options) {

    var isMultiple = (options.multiple) ? true : false;
    var field = options.field;
    
    var linkId = "fbldr-link-" + field.id;
    var link = "#" + linkId;
    var listId = "fbldr-field-" + field.id;
    var list = "#" + listId;

    var $userList = $j(list);
            
    $j(link).click(function() {
        osapi.jive.core.users.requestPicker({
            multiple : isMultiple,
            success : function(response) {
                // if multiple is true, response.data will be an array
                // of osapi.jive.core.User objects
                var users;
                if ($j.isArray(response.data)) {
                    users = response.data;
                } else {
                    users = new Array();
                    users.push(response.data);
                }

                $j.each(users, function() {
                    var user = this;
                    if (!isInUserList(user)) {
                        var $user = $j('<li title="Click to remove user"/>')
                            .html('<span class="fbldr-userpicker-remove">[x]</span> ' + user.name)
                            .attr('userid', user.id)
                            .attr('username', user.name);
                        $user.appendTo($userList);
                        $user.click(function() {
                            $j(this).remove();
                            // gadgets.window.adjustHeight();
                        });
                        // gadgets.window.adjustHeight();
                    }
                });
            },
            error : function(error) {
                console.log("An unexpected error has occurred while initializing userpicker");
            }
        });
    });

    var isInUserList = function(user) {
        var users = $userList.find('li');
        for ( var i = 0; i < users.length; i++) {
            if ($j(users[i]).attr('userid') == user.id)
                return true;
        }
        return false;
    }
    
}
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

// This command is only needed for doing local testing with plovr
// which uses the google closure library for dependencies
// goog.require('jive.fbldr.soy');

$j(document).ready(function() {

    $j('#fbldr-menu-create a').click(function() {
        displayView('create');
    });
    
    $j('#fbldr-menu-help a').click(function() {
        displayView('help');
    });
    
    $j('#fbldr-menu-forms a').click(function() {
        displayView('forms');
    });
    
    var displayView = function(displayName) {
        var canvas_view = new gadgets.views.View("canvas");
        gadgets.views.requestNavigateTo(canvas_view, { display: displayName });
        return false;
    };

    var viewParams = gadgets.views.getParams();

    if (viewParams['display'] == 'create') {
        var formCreator = new jive.fbldr.FormCreator({
        });        
    }
    else if (viewParams['display'] == 'help') {
        var formHelp = new jive.fbldr.FormHelp({
        });
    }
    else {
        var formBuilder = new jive.fbldr.FormBuilder({
            containerId: "fbldr-main",
            infoId: "fbldr-info"
        });
    }
});

if (typeof(gadgets) != "undefined") {
    gadgets.util.registerOnLoadHandler(function() {
        // gadgets.window.setTitle('Forms');
        // gadgets.window.adjustHeight();
    });
}