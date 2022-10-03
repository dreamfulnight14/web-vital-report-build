/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const directives = new WeakMap();
const isDirective = (o) => {
    return typeof o === 'function' && directives.has(o);
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * True if the custom elements polyfill is in use.
 */
const isCEPolyfill = typeof window !== 'undefined' &&
    window.customElements != null &&
    window.customElements.polyfillWrapFlushCallback !==
        undefined;
/**
 * Reparents nodes, starting from `start` (inclusive) to `end` (exclusive),
 * into another container (could be the same container), before `before`. If
 * `before` is null, it appends the nodes to the container.
 */
const reparentNodes = (container, start, end = null, before = null) => {
    while (start !== end) {
        const n = start.nextSibling;
        container.insertBefore(start, before);
        start = n;
    }
};
/**
 * Removes nodes, starting from `start` (inclusive) to `end` (exclusive), from
 * `container`.
 */
const removeNodes = (container, start, end = null) => {
    while (start !== end) {
        const n = start.nextSibling;
        container.removeChild(start);
        start = n;
    }
};

/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * A sentinel value that signals that a value was handled by a directive and
 * should not be written to the DOM.
 */
const noChange = {};
/**
 * A sentinel value that signals a NodePart to fully clear its content.
 */
const nothing = {};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * An expression marker with embedded unique key to avoid collision with
 * possible text in templates.
 */
const marker = `{{lit-${String(Math.random()).slice(2)}}}`;
/**
 * An expression marker used text-positions, multi-binding attributes, and
 * attributes with markup-like text values.
 */
const nodeMarker = `<!--${marker}-->`;
const markerRegex = new RegExp(`${marker}|${nodeMarker}`);
/**
 * Suffix appended to all bound attribute names.
 */
const boundAttributeSuffix = '$lit$';
/**
 * An updatable Template that tracks the location of dynamic parts.
 */
class Template {
    constructor(result, element) {
        this.parts = [];
        this.element = element;
        const nodesToRemove = [];
        const stack = [];
        // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be null
        const walker = document.createTreeWalker(element.content, 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */, null, false);
        // Keeps track of the last index associated with a part. We try to delete
        // unnecessary nodes, but we never want to associate two different parts
        // to the same index. They must have a constant node between.
        let lastPartIndex = 0;
        let index = -1;
        let partIndex = 0;
        const { strings, values: { length } } = result;
        while (partIndex < length) {
            const node = walker.nextNode();
            if (node === null) {
                // We've exhausted the content inside a nested template element.
                // Because we still have parts (the outer for-loop), we know:
                // - There is a template in the stack
                // - The walker will find a nextNode outside the template
                walker.currentNode = stack.pop();
                continue;
            }
            index++;
            if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
                if (node.hasAttributes()) {
                    const attributes = node.attributes;
                    const { length } = attributes;
                    // Per
                    // https://developer.mozilla.org/en-US/docs/Web/API/NamedNodeMap,
                    // attributes are not guaranteed to be returned in document order.
                    // In particular, Edge/IE can return them out of order, so we cannot
                    // assume a correspondence between part index and attribute index.
                    let count = 0;
                    for (let i = 0; i < length; i++) {
                        if (endsWith(attributes[i].name, boundAttributeSuffix)) {
                            count++;
                        }
                    }
                    while (count-- > 0) {
                        // Get the template literal section leading up to the first
                        // expression in this attribute
                        const stringForPart = strings[partIndex];
                        // Find the attribute name
                        const name = lastAttributeNameRegex.exec(stringForPart)[2];
                        // Find the corresponding attribute
                        // All bound attributes have had a suffix added in
                        // TemplateResult#getHTML to opt out of special attribute
                        // handling. To look up the attribute value we also need to add
                        // the suffix.
                        const attributeLookupName = name.toLowerCase() + boundAttributeSuffix;
                        const attributeValue = node.getAttribute(attributeLookupName);
                        node.removeAttribute(attributeLookupName);
                        const statics = attributeValue.split(markerRegex);
                        this.parts.push({ type: 'attribute', index, name, strings: statics });
                        partIndex += statics.length - 1;
                    }
                }
                if (node.tagName === 'TEMPLATE') {
                    stack.push(node);
                    walker.currentNode = node.content;
                }
            }
            else if (node.nodeType === 3 /* Node.TEXT_NODE */) {
                const data = node.data;
                if (data.indexOf(marker) >= 0) {
                    const parent = node.parentNode;
                    const strings = data.split(markerRegex);
                    const lastIndex = strings.length - 1;
                    // Generate a new text node for each literal section
                    // These nodes are also used as the markers for node parts
                    for (let i = 0; i < lastIndex; i++) {
                        let insert;
                        let s = strings[i];
                        if (s === '') {
                            insert = createMarker();
                        }
                        else {
                            const match = lastAttributeNameRegex.exec(s);
                            if (match !== null && endsWith(match[2], boundAttributeSuffix)) {
                                s = s.slice(0, match.index) + match[1] +
                                    match[2].slice(0, -boundAttributeSuffix.length) + match[3];
                            }
                            insert = document.createTextNode(s);
                        }
                        parent.insertBefore(insert, node);
                        this.parts.push({ type: 'node', index: ++index });
                    }
                    // If there's no text, we must insert a comment to mark our place.
                    // Else, we can trust it will stick around after cloning.
                    if (strings[lastIndex] === '') {
                        parent.insertBefore(createMarker(), node);
                        nodesToRemove.push(node);
                    }
                    else {
                        node.data = strings[lastIndex];
                    }
                    // We have a part for each match found
                    partIndex += lastIndex;
                }
            }
            else if (node.nodeType === 8 /* Node.COMMENT_NODE */) {
                if (node.data === marker) {
                    const parent = node.parentNode;
                    // Add a new marker node to be the startNode of the Part if any of
                    // the following are true:
                    //  * We don't have a previousSibling
                    //  * The previousSibling is already the start of a previous part
                    if (node.previousSibling === null || index === lastPartIndex) {
                        index++;
                        parent.insertBefore(createMarker(), node);
                    }
                    lastPartIndex = index;
                    this.parts.push({ type: 'node', index });
                    // If we don't have a nextSibling, keep this node so we have an end.
                    // Else, we can remove it to save future costs.
                    if (node.nextSibling === null) {
                        node.data = '';
                    }
                    else {
                        nodesToRemove.push(node);
                        index--;
                    }
                    partIndex++;
                }
                else {
                    let i = -1;
                    while ((i = node.data.indexOf(marker, i + 1)) !== -1) {
                        // Comment node has a binding marker inside, make an inactive part
                        // The binding won't work, but subsequent bindings will
                        // TODO (justinfagnani): consider whether it's even worth it to
                        // make bindings in comments work
                        this.parts.push({ type: 'node', index: -1 });
                        partIndex++;
                    }
                }
            }
        }
        // Remove text binding nodes after the walk to not disturb the TreeWalker
        for (const n of nodesToRemove) {
            n.parentNode.removeChild(n);
        }
    }
}
const endsWith = (str, suffix) => {
    const index = str.length - suffix.length;
    return index >= 0 && str.slice(index) === suffix;
};
const isTemplatePartActive = (part) => part.index !== -1;
// Allows `document.createComment('')` to be renamed for a
// small manual size-savings.
const createMarker = () => document.createComment('');
/**
 * This regex extracts the attribute name preceding an attribute-position
 * expression. It does this by matching the syntax allowed for attributes
 * against the string literal directly preceding the expression, assuming that
 * the expression is in an attribute-value position.
 *
 * See attributes in the HTML spec:
 * https://www.w3.org/TR/html5/syntax.html#elements-attributes
 *
 * " \x09\x0a\x0c\x0d" are HTML space characters:
 * https://www.w3.org/TR/html5/infrastructure.html#space-characters
 *
 * "\0-\x1F\x7F-\x9F" are Unicode control characters, which includes every
 * space character except " ".
 *
 * So an attribute is:
 *  * The name: any character except a control character, space character, ('),
 *    ("), ">", "=", or "/"
 *  * Followed by zero or more space characters
 *  * Followed by "="
 *  * Followed by zero or more space characters
 *  * Followed by:
 *    * Any character except space, ('), ("), "<", ">", "=", (`), or
 *    * (") then any non-("), or
 *    * (') then any non-(')
 */
const lastAttributeNameRegex = 
// eslint-disable-next-line no-control-regex
/([ \x09\x0a\x0c\x0d])([^\0-\x1F\x7F-\x9F "'>=/]+)([ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*(?:[^ \x09\x0a\x0c\x0d"'`<>=]*|"[^"]*|'[^']*))$/;

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * An instance of a `Template` that can be attached to the DOM and updated
 * with new values.
 */
class TemplateInstance {
    constructor(template, processor, options) {
        this.__parts = [];
        this.template = template;
        this.processor = processor;
        this.options = options;
    }
    update(values) {
        let i = 0;
        for (const part of this.__parts) {
            if (part !== undefined) {
                part.setValue(values[i]);
            }
            i++;
        }
        for (const part of this.__parts) {
            if (part !== undefined) {
                part.commit();
            }
        }
    }
    _clone() {
        // There are a number of steps in the lifecycle of a template instance's
        // DOM fragment:
        //  1. Clone - create the instance fragment
        //  2. Adopt - adopt into the main document
        //  3. Process - find part markers and create parts
        //  4. Upgrade - upgrade custom elements
        //  5. Update - set node, attribute, property, etc., values
        //  6. Connect - connect to the document. Optional and outside of this
        //     method.
        //
        // We have a few constraints on the ordering of these steps:
        //  * We need to upgrade before updating, so that property values will pass
        //    through any property setters.
        //  * We would like to process before upgrading so that we're sure that the
        //    cloned fragment is inert and not disturbed by self-modifying DOM.
        //  * We want custom elements to upgrade even in disconnected fragments.
        //
        // Given these constraints, with full custom elements support we would
        // prefer the order: Clone, Process, Adopt, Upgrade, Update, Connect
        //
        // But Safari does not implement CustomElementRegistry#upgrade, so we
        // can not implement that order and still have upgrade-before-update and
        // upgrade disconnected fragments. So we instead sacrifice the
        // process-before-upgrade constraint, since in Custom Elements v1 elements
        // must not modify their light DOM in the constructor. We still have issues
        // when co-existing with CEv0 elements like Polymer 1, and with polyfills
        // that don't strictly adhere to the no-modification rule because shadow
        // DOM, which may be created in the constructor, is emulated by being placed
        // in the light DOM.
        //
        // The resulting order is on native is: Clone, Adopt, Upgrade, Process,
        // Update, Connect. document.importNode() performs Clone, Adopt, and Upgrade
        // in one step.
        //
        // The Custom Elements v1 polyfill supports upgrade(), so the order when
        // polyfilled is the more ideal: Clone, Process, Adopt, Upgrade, Update,
        // Connect.
        const fragment = isCEPolyfill ?
            this.template.element.content.cloneNode(true) :
            document.importNode(this.template.element.content, true);
        const stack = [];
        const parts = this.template.parts;
        // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be null
        const walker = document.createTreeWalker(fragment, 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */, null, false);
        let partIndex = 0;
        let nodeIndex = 0;
        let part;
        let node = walker.nextNode();
        // Loop through all the nodes and parts of a template
        while (partIndex < parts.length) {
            part = parts[partIndex];
            if (!isTemplatePartActive(part)) {
                this.__parts.push(undefined);
                partIndex++;
                continue;
            }
            // Progress the tree walker until we find our next part's node.
            // Note that multiple parts may share the same node (attribute parts
            // on a single element), so this loop may not run at all.
            while (nodeIndex < part.index) {
                nodeIndex++;
                if (node.nodeName === 'TEMPLATE') {
                    stack.push(node);
                    walker.currentNode = node.content;
                }
                if ((node = walker.nextNode()) === null) {
                    // We've exhausted the content inside a nested template element.
                    // Because we still have parts (the outer for-loop), we know:
                    // - There is a template in the stack
                    // - The walker will find a nextNode outside the template
                    walker.currentNode = stack.pop();
                    node = walker.nextNode();
                }
            }
            // We've arrived at our part's node.
            if (part.type === 'node') {
                const part = this.processor.handleTextExpression(this.options);
                part.insertAfterNode(node.previousSibling);
                this.__parts.push(part);
            }
            else {
                this.__parts.push(...this.processor.handleAttributeExpressions(node, part.name, part.strings, this.options));
            }
            partIndex++;
        }
        if (isCEPolyfill) {
            document.adoptNode(fragment);
            customElements.upgrade(fragment);
        }
        return fragment;
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * Our TrustedTypePolicy for HTML which is declared using the html template
 * tag function.
 *
 * That HTML is a developer-authored constant, and is parsed with innerHTML
 * before any untrusted expressions have been mixed in. Therefor it is
 * considered safe by construction.
 */
const policy = window.trustedTypes &&
    trustedTypes.createPolicy('lit-html', { createHTML: (s) => s });
const commentMarker = ` ${marker} `;
/**
 * The return type of `html`, which holds a Template and the values from
 * interpolated expressions.
 */
class TemplateResult {
    constructor(strings, values, type, processor) {
        this.strings = strings;
        this.values = values;
        this.type = type;
        this.processor = processor;
    }
    /**
     * Returns a string of HTML used to create a `<template>` element.
     */
    getHTML() {
        const l = this.strings.length - 1;
        let html = '';
        let isCommentBinding = false;
        for (let i = 0; i < l; i++) {
            const s = this.strings[i];
            // For each binding we want to determine the kind of marker to insert
            // into the template source before it's parsed by the browser's HTML
            // parser. The marker type is based on whether the expression is in an
            // attribute, text, or comment position.
            //   * For node-position bindings we insert a comment with the marker
            //     sentinel as its text content, like <!--{{lit-guid}}-->.
            //   * For attribute bindings we insert just the marker sentinel for the
            //     first binding, so that we support unquoted attribute bindings.
            //     Subsequent bindings can use a comment marker because multi-binding
            //     attributes must be quoted.
            //   * For comment bindings we insert just the marker sentinel so we don't
            //     close the comment.
            //
            // The following code scans the template source, but is *not* an HTML
            // parser. We don't need to track the tree structure of the HTML, only
            // whether a binding is inside a comment, and if not, if it appears to be
            // the first binding in an attribute.
            const commentOpen = s.lastIndexOf('<!--');
            // We're in comment position if we have a comment open with no following
            // comment close. Because <-- can appear in an attribute value there can
            // be false positives.
            isCommentBinding = (commentOpen > -1 || isCommentBinding) &&
                s.indexOf('-->', commentOpen + 1) === -1;
            // Check to see if we have an attribute-like sequence preceding the
            // expression. This can match "name=value" like structures in text,
            // comments, and attribute values, so there can be false-positives.
            const attributeMatch = lastAttributeNameRegex.exec(s);
            if (attributeMatch === null) {
                // We're only in this branch if we don't have a attribute-like
                // preceding sequence. For comments, this guards against unusual
                // attribute values like <div foo="<!--${'bar'}">. Cases like
                // <!-- foo=${'bar'}--> are handled correctly in the attribute branch
                // below.
                html += s + (isCommentBinding ? commentMarker : nodeMarker);
            }
            else {
                // For attributes we use just a marker sentinel, and also append a
                // $lit$ suffix to the name to opt-out of attribute-specific parsing
                // that IE and Edge do for style and certain SVG attributes.
                html += s.substr(0, attributeMatch.index) + attributeMatch[1] +
                    attributeMatch[2] + boundAttributeSuffix + attributeMatch[3] +
                    marker;
            }
        }
        html += this.strings[l];
        return html;
    }
    getTemplateElement() {
        const template = document.createElement('template');
        let value = this.getHTML();
        if (policy !== undefined) {
            // this is secure because `this.strings` is a TemplateStringsArray.
            // TODO: validate this when
            // https://github.com/tc39/proposal-array-is-template-object is
            // implemented.
            value = policy.createHTML(value);
        }
        template.innerHTML = value;
        return template;
    }
}
/**
 * A TemplateResult for SVG fragments.
 *
 * This class wraps HTML in an `<svg>` tag in order to parse its contents in the
 * SVG namespace, then modifies the template to remove the `<svg>` tag so that
 * clones only container the original fragment.
 */
class SVGTemplateResult extends TemplateResult {
    getHTML() {
        return `<svg>${super.getHTML()}</svg>`;
    }
    getTemplateElement() {
        const template = super.getTemplateElement();
        const content = template.content;
        const svgElement = content.firstChild;
        content.removeChild(svgElement);
        reparentNodes(content, svgElement.firstChild);
        return template;
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const isPrimitive = (value) => {
    return (value === null ||
        !(typeof value === 'object' || typeof value === 'function'));
};
const isIterable = (value) => {
    return Array.isArray(value) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        !!(value && value[Symbol.iterator]);
};
/**
 * Writes attribute values to the DOM for a group of AttributeParts bound to a
 * single attribute. The value is only set once even if there are multiple parts
 * for an attribute.
 */
class AttributeCommitter {
    constructor(element, name, strings) {
        this.dirty = true;
        this.element = element;
        this.name = name;
        this.strings = strings;
        this.parts = [];
        for (let i = 0; i < strings.length - 1; i++) {
            this.parts[i] = this._createPart();
        }
    }
    /**
     * Creates a single part. Override this to create a differnt type of part.
     */
    _createPart() {
        return new AttributePart(this);
    }
    _getValue() {
        const strings = this.strings;
        const l = strings.length - 1;
        const parts = this.parts;
        // If we're assigning an attribute via syntax like:
        //    attr="${foo}"  or  attr=${foo}
        // but not
        //    attr="${foo} ${bar}" or attr="${foo} baz"
        // then we don't want to coerce the attribute value into one long
        // string. Instead we want to just return the value itself directly,
        // so that sanitizeDOMValue can get the actual value rather than
        // String(value)
        // The exception is if v is an array, in which case we do want to smash
        // it together into a string without calling String() on the array.
        //
        // This also allows trusted values (when using TrustedTypes) being
        // assigned to DOM sinks without being stringified in the process.
        if (l === 1 && strings[0] === '' && strings[1] === '') {
            const v = parts[0].value;
            if (typeof v === 'symbol') {
                return String(v);
            }
            if (typeof v === 'string' || !isIterable(v)) {
                return v;
            }
        }
        let text = '';
        for (let i = 0; i < l; i++) {
            text += strings[i];
            const part = parts[i];
            if (part !== undefined) {
                const v = part.value;
                if (isPrimitive(v) || !isIterable(v)) {
                    text += typeof v === 'string' ? v : String(v);
                }
                else {
                    for (const t of v) {
                        text += typeof t === 'string' ? t : String(t);
                    }
                }
            }
        }
        text += strings[l];
        return text;
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            this.element.setAttribute(this.name, this._getValue());
        }
    }
}
/**
 * A Part that controls all or part of an attribute value.
 */
class AttributePart {
    constructor(committer) {
        this.value = undefined;
        this.committer = committer;
    }
    setValue(value) {
        if (value !== noChange && (!isPrimitive(value) || value !== this.value)) {
            this.value = value;
            // If the value is a not a directive, dirty the committer so that it'll
            // call setAttribute. If the value is a directive, it'll dirty the
            // committer if it calls setValue().
            if (!isDirective(value)) {
                this.committer.dirty = true;
            }
        }
    }
    commit() {
        while (isDirective(this.value)) {
            const directive = this.value;
            this.value = noChange;
            directive(this);
        }
        if (this.value === noChange) {
            return;
        }
        this.committer.commit();
    }
}
/**
 * A Part that controls a location within a Node tree. Like a Range, NodePart
 * has start and end locations and can set and update the Nodes between those
 * locations.
 *
 * NodeParts support several value types: primitives, Nodes, TemplateResults,
 * as well as arrays and iterables of those types.
 */
class NodePart {
    constructor(options) {
        this.value = undefined;
        this.__pendingValue = undefined;
        this.options = options;
    }
    /**
     * Appends this part into a container.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    appendInto(container) {
        this.startNode = container.appendChild(createMarker());
        this.endNode = container.appendChild(createMarker());
    }
    /**
     * Inserts this part after the `ref` node (between `ref` and `ref`'s next
     * sibling). Both `ref` and its next sibling must be static, unchanging nodes
     * such as those that appear in a literal section of a template.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    insertAfterNode(ref) {
        this.startNode = ref;
        this.endNode = ref.nextSibling;
    }
    /**
     * Appends this part into a parent part.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    appendIntoPart(part) {
        part.__insert(this.startNode = createMarker());
        part.__insert(this.endNode = createMarker());
    }
    /**
     * Inserts this part after the `ref` part.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    insertAfterPart(ref) {
        ref.__insert(this.startNode = createMarker());
        this.endNode = ref.endNode;
        ref.endNode = this.startNode;
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        if (this.startNode.parentNode === null) {
            return;
        }
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        const value = this.__pendingValue;
        if (value === noChange) {
            return;
        }
        if (isPrimitive(value)) {
            if (value !== this.value) {
                this.__commitText(value);
            }
        }
        else if (value instanceof TemplateResult) {
            this.__commitTemplateResult(value);
        }
        else if (value instanceof Node) {
            this.__commitNode(value);
        }
        else if (isIterable(value)) {
            this.__commitIterable(value);
        }
        else if (value === nothing) {
            this.value = nothing;
            this.clear();
        }
        else {
            // Fallback, will render the string representation
            this.__commitText(value);
        }
    }
    __insert(node) {
        this.endNode.parentNode.insertBefore(node, this.endNode);
    }
    __commitNode(value) {
        if (this.value === value) {
            return;
        }
        this.clear();
        this.__insert(value);
        this.value = value;
    }
    __commitText(value) {
        const node = this.startNode.nextSibling;
        value = value == null ? '' : value;
        // If `value` isn't already a string, we explicitly convert it here in case
        // it can't be implicitly converted - i.e. it's a symbol.
        const valueAsString = typeof value === 'string' ? value : String(value);
        if (node === this.endNode.previousSibling &&
            node.nodeType === 3 /* Node.TEXT_NODE */) {
            // If we only have a single text node between the markers, we can just
            // set its value, rather than replacing it.
            // TODO(justinfagnani): Can we just check if this.value is primitive?
            node.data = valueAsString;
        }
        else {
            this.__commitNode(document.createTextNode(valueAsString));
        }
        this.value = value;
    }
    __commitTemplateResult(value) {
        const template = this.options.templateFactory(value);
        if (this.value instanceof TemplateInstance &&
            this.value.template === template) {
            this.value.update(value.values);
        }
        else {
            // Make sure we propagate the template processor from the TemplateResult
            // so that we use its syntax extension, etc. The template factory comes
            // from the render function options so that it can control template
            // caching and preprocessing.
            const instance = new TemplateInstance(template, value.processor, this.options);
            const fragment = instance._clone();
            instance.update(value.values);
            this.__commitNode(fragment);
            this.value = instance;
        }
    }
    __commitIterable(value) {
        // For an Iterable, we create a new InstancePart per item, then set its
        // value to the item. This is a little bit of overhead for every item in
        // an Iterable, but it lets us recurse easily and efficiently update Arrays
        // of TemplateResults that will be commonly returned from expressions like:
        // array.map((i) => html`${i}`), by reusing existing TemplateInstances.
        // If _value is an array, then the previous render was of an
        // iterable and _value will contain the NodeParts from the previous
        // render. If _value is not an array, clear this part and make a new
        // array for NodeParts.
        if (!Array.isArray(this.value)) {
            this.value = [];
            this.clear();
        }
        // Lets us keep track of how many items we stamped so we can clear leftover
        // items from a previous render
        const itemParts = this.value;
        let partIndex = 0;
        let itemPart;
        for (const item of value) {
            // Try to reuse an existing part
            itemPart = itemParts[partIndex];
            // If no existing part, create a new one
            if (itemPart === undefined) {
                itemPart = new NodePart(this.options);
                itemParts.push(itemPart);
                if (partIndex === 0) {
                    itemPart.appendIntoPart(this);
                }
                else {
                    itemPart.insertAfterPart(itemParts[partIndex - 1]);
                }
            }
            itemPart.setValue(item);
            itemPart.commit();
            partIndex++;
        }
        if (partIndex < itemParts.length) {
            // Truncate the parts array so _value reflects the current state
            itemParts.length = partIndex;
            this.clear(itemPart && itemPart.endNode);
        }
    }
    clear(startNode = this.startNode) {
        removeNodes(this.startNode.parentNode, startNode.nextSibling, this.endNode);
    }
}
/**
 * Implements a boolean attribute, roughly as defined in the HTML
 * specification.
 *
 * If the value is truthy, then the attribute is present with a value of
 * ''. If the value is falsey, the attribute is removed.
 */
class BooleanAttributePart {
    constructor(element, name, strings) {
        this.value = undefined;
        this.__pendingValue = undefined;
        if (strings.length !== 2 || strings[0] !== '' || strings[1] !== '') {
            throw new Error('Boolean attributes can only contain a single expression');
        }
        this.element = element;
        this.name = name;
        this.strings = strings;
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        if (this.__pendingValue === noChange) {
            return;
        }
        const value = !!this.__pendingValue;
        if (this.value !== value) {
            if (value) {
                this.element.setAttribute(this.name, '');
            }
            else {
                this.element.removeAttribute(this.name);
            }
            this.value = value;
        }
        this.__pendingValue = noChange;
    }
}
/**
 * Sets attribute values for PropertyParts, so that the value is only set once
 * even if there are multiple parts for a property.
 *
 * If an expression controls the whole property value, then the value is simply
 * assigned to the property under control. If there are string literals or
 * multiple expressions, then the strings are expressions are interpolated into
 * a string first.
 */
class PropertyCommitter extends AttributeCommitter {
    constructor(element, name, strings) {
        super(element, name, strings);
        this.single =
            (strings.length === 2 && strings[0] === '' && strings[1] === '');
    }
    _createPart() {
        return new PropertyPart(this);
    }
    _getValue() {
        if (this.single) {
            return this.parts[0].value;
        }
        return super._getValue();
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.element[this.name] = this._getValue();
        }
    }
}
class PropertyPart extends AttributePart {
}
// Detect event listener options support. If the `capture` property is read
// from the options object, then options are supported. If not, then the third
// argument to add/removeEventListener is interpreted as the boolean capture
// value so we should only pass the `capture` property.
let eventOptionsSupported = false;
// Wrap into an IIFE because MS Edge <= v41 does not support having try/catch
// blocks right into the body of a module
(() => {
    try {
        const options = {
            get capture() {
                eventOptionsSupported = true;
                return false;
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.addEventListener('test', options, options);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.removeEventListener('test', options, options);
    }
    catch (_e) {
        // event options not supported
    }
})();
class EventPart {
    constructor(element, eventName, eventContext) {
        this.value = undefined;
        this.__pendingValue = undefined;
        this.element = element;
        this.eventName = eventName;
        this.eventContext = eventContext;
        this.__boundHandleEvent = (e) => this.handleEvent(e);
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        if (this.__pendingValue === noChange) {
            return;
        }
        const newListener = this.__pendingValue;
        const oldListener = this.value;
        const shouldRemoveListener = newListener == null ||
            oldListener != null &&
                (newListener.capture !== oldListener.capture ||
                    newListener.once !== oldListener.once ||
                    newListener.passive !== oldListener.passive);
        const shouldAddListener = newListener != null && (oldListener == null || shouldRemoveListener);
        if (shouldRemoveListener) {
            this.element.removeEventListener(this.eventName, this.__boundHandleEvent, this.__options);
        }
        if (shouldAddListener) {
            this.__options = getOptions(newListener);
            this.element.addEventListener(this.eventName, this.__boundHandleEvent, this.__options);
        }
        this.value = newListener;
        this.__pendingValue = noChange;
    }
    handleEvent(event) {
        if (typeof this.value === 'function') {
            this.value.call(this.eventContext || this.element, event);
        }
        else {
            this.value.handleEvent(event);
        }
    }
}
// We copy options because of the inconsistent behavior of browsers when reading
// the third argument of add/removeEventListener. IE11 doesn't support options
// at all. Chrome 41 only reads `capture` if the argument is an object.
const getOptions = (o) => o &&
    (eventOptionsSupported ?
        { capture: o.capture, passive: o.passive, once: o.once } :
        o.capture);

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * Creates Parts when a template is instantiated.
 */
class DefaultTemplateProcessor {
    /**
     * Create parts for an attribute-position binding, given the event, attribute
     * name, and string literals.
     *
     * @param element The element containing the binding
     * @param name  The attribute name
     * @param strings The string literals. There are always at least two strings,
     *   event for fully-controlled bindings with a single expression.
     */
    handleAttributeExpressions(element, name, strings, options) {
        const prefix = name[0];
        if (prefix === '.') {
            const committer = new PropertyCommitter(element, name.slice(1), strings);
            return committer.parts;
        }
        if (prefix === '@') {
            return [new EventPart(element, name.slice(1), options.eventContext)];
        }
        if (prefix === '?') {
            return [new BooleanAttributePart(element, name.slice(1), strings)];
        }
        const committer = new AttributeCommitter(element, name, strings);
        return committer.parts;
    }
    /**
     * Create parts for a text-position binding.
     * @param templateFactory
     */
    handleTextExpression(options) {
        return new NodePart(options);
    }
}
const defaultTemplateProcessor = new DefaultTemplateProcessor();

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * The default TemplateFactory which caches Templates keyed on
 * result.type and result.strings.
 */
function templateFactory(result) {
    let templateCache = templateCaches.get(result.type);
    if (templateCache === undefined) {
        templateCache = {
            stringsArray: new WeakMap(),
            keyString: new Map()
        };
        templateCaches.set(result.type, templateCache);
    }
    let template = templateCache.stringsArray.get(result.strings);
    if (template !== undefined) {
        return template;
    }
    // If the TemplateStringsArray is new, generate a key from the strings
    // This key is shared between all templates with identical content
    const key = result.strings.join(marker);
    // Check if we already have a Template for this key
    template = templateCache.keyString.get(key);
    if (template === undefined) {
        // If we have not seen this key before, create a new Template
        template = new Template(result, result.getTemplateElement());
        // Cache the Template for this key
        templateCache.keyString.set(key, template);
    }
    // Cache all future queries for this TemplateStringsArray
    templateCache.stringsArray.set(result.strings, template);
    return template;
}
const templateCaches = new Map();

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const parts = new WeakMap();
/**
 * Renders a template result or other value to a container.
 *
 * To update a container with new values, reevaluate the template literal and
 * call `render` with the new result.
 *
 * @param result Any value renderable by NodePart - typically a TemplateResult
 *     created by evaluating a template tag like `html` or `svg`.
 * @param container A DOM parent to render to. The entire contents are either
 *     replaced, or efficiently updated if the same result type was previous
 *     rendered there.
 * @param options RenderOptions for the entire render tree rendered to this
 *     container. Render options must *not* change between renders to the same
 *     container, as those changes will not effect previously rendered DOM.
 */
const render = (result, container, options) => {
    let part = parts.get(container);
    if (part === undefined) {
        removeNodes(container, container.firstChild);
        parts.set(container, part = new NodePart(Object.assign({ templateFactory }, options)));
        part.appendInto(container);
    }
    part.setValue(result);
    part.commit();
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for lit-html usage.
// TODO(justinfagnani): inject version number at build time
if (typeof window !== 'undefined') {
    (window['litHtmlVersions'] || (window['litHtmlVersions'] = [])).push('1.4.1');
}
/**
 * Interprets a template literal as an HTML template that can efficiently
 * render to and update a container.
 */
const html = (strings, ...values) => new TemplateResult(strings, values, 'html', defaultTemplateProcessor);
/**
 * Interprets a template literal as an SVG template that can efficiently
 * render to and update a container.
 */
const svg = (strings, ...values) => new SVGTemplateResult(strings, values, 'svg', defaultTemplateProcessor);

/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const DAY = 1000 * 60 * 60 * 24;

/**
 * Accepts a date and returns a date string in YYYY-MM-DD format.
 * @param {Date} date
 * @return {string}
 */
function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function toISODate(d) {
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6)].join("-");
}

/**
 * Accepts an integer and returns a date string (YYYY-MM-DD) for the given
 * number of days (before or after) the current date (in the user's timezone).
 * @param {number} offset
 * @return {string}
 */
function dateOffset(offset) {
  const date = new Date();
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return toDateString(new Date(today + offset * DAY));
}

function getDatesInRange(startDate, endDate) {
  const dates = [];
  let date = startDate;
  while (date <= endDate) {
    dates.push(date);
    date = toDateString(new Date(DAY + new Date(date).getTime()));
  }
  return dates;
}

/**
 * Escapes an untrusted HTML string.
 * @param {string} unsafe
 * @return {string}
 */
function e$1(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function mergeSortedArrays(r1, r2, getValue) {
  const merged = [];
  let i1 = 0;
  let i2 = 0;

  while (merged.length < r1.length + r2.length) {
    if (
      i1 < r1.length &&
      (i2 >= r2.length || getValue(r1[i1]) < getValue(r2[i2]))
    ) {
      merged.push(r1[i1++]);
    } else {
      merged.push(r2[i2++]);
    }
  }
  return merged;
}

class Deferred {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

function nextFrame() {
  return new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))
  );
}

function timeout(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function hashObj(obj) {
  const text = JSON.stringify(obj);
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-1", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function round(num, decimalPlaces) {
  const multiplier = Math.pow(10, decimalPlaces);
  return Math.round(num * multiplier) / multiplier;
}

/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


const ALERT_TRANSITION_TIME = 200;
const DEFAULT_TITLE = 'Oops, something went wrong!';

const state$1 = {};
let alertShowing = false;

/**
 * Returns the markup to generate an SVG icon.
 * @param {string} id The icon id from the main icons file.
 * @return {string} The icon markup.
 */
function renderIcon(id) {
  const href = `#icon-${id}`;
  return svg`<svg class="Icon" viewBox="0 0 24 24">
    <use href=${href}></use>
  </svg>`;
}

function renderAlert() {
  const classes = ['Alert'];
  if (state$1.isTransitioning) classes.push('Alert--isTransitioning');
  if (state$1.isActive) classes.push('Alert--isActive');

  return html`
    <div class=${classes.join(' ')}>
      <div class="Alert-icon">
        ${renderIcon('error-outline')}
      </div>
      <div class="Alert-body">
        <h1 class="Alert-title">${state$1.title}</h1>
        <div class="Alert-message">${state$1.message}</div>
      </div>
      <button @click=${remove} class="Alert-close">
        ${renderIcon('close')}
      </button>
    </div>
  `;
}

function onContainerClick(event) {
  if (event.target === event.currentTarget) {
    remove();
  }
}

function renderAlertContainer() {
  render(alertShowing ? html`
    <div @click=${onContainerClick} class="AlertContainer">
      ${renderAlert()}
    </div>
  ` : undefined, document.getElementById('alerts'));
}

async function transition(isActive) {
  await nextFrame();
  state$1.isActive = isActive;
  state$1.isTransitioning = true;
  renderAlertContainer();

  await timeout(ALERT_TRANSITION_TIME);

  state$1.isActive = isActive;
  state$1.isTransitioning = false;
  renderAlertContainer();
}

async function remove() {
  if (!alertShowing) return;

  await transition(false);

  alertShowing = false;
  renderAlertContainer();
}

async function addAlert(error) {
  if (alertShowing) {
    await remove();
  }

  state$1.title = error.title || DEFAULT_TITLE;
  state$1.message = error.message;

  alertShowing = true;
  renderAlertContainer();

  await transition(true);
  document.getElementById('alerts').focus();
}

var e,t,n,i,r=function(e,t){return {name:e,value:void 0===t?-1:t,delta:0,entries:[],id:"v2-".concat(Date.now(),"-").concat(Math.floor(8999999999999*Math.random())+1e12)}},a=function(e,t){try{if(PerformanceObserver.supportedEntryTypes.includes(e)){if("first-input"===e&&!("PerformanceEventTiming"in self))return;var n=new PerformanceObserver((function(e){return e.getEntries().map(t)}));return n.observe({type:e,buffered:!0}),n}}catch(e){}},o=function(e,t){var n=function n(i){"pagehide"!==i.type&&"hidden"!==document.visibilityState||(e(i),t&&(removeEventListener("visibilitychange",n,!0),removeEventListener("pagehide",n,!0)));};addEventListener("visibilitychange",n,!0),addEventListener("pagehide",n,!0);},c=function(e){addEventListener("pageshow",(function(t){t.persisted&&e(t);}),!0);},u=function(e,t,n){var i;return function(r){t.value>=0&&(r||n)&&(t.delta=t.value-(i||0),(t.delta||void 0===i)&&(i=t.value,e(t)));}},f=-1,s=function(){return "hidden"===document.visibilityState?0:1/0},m=function(){o((function(e){var t=e.timeStamp;f=t;}),!0);},v=function(){return f<0&&(f=s(),m(),c((function(){setTimeout((function(){f=s(),m();}),0);}))),{get firstHiddenTime(){return f}}},p$1=function(e,t){var n,i=v(),o=r("FCP"),f=function(e){"first-contentful-paint"===e.name&&(m&&m.disconnect(),e.startTime<i.firstHiddenTime&&(o.value=e.startTime,o.entries.push(e),n(!0)));},s=window.performance&&performance.getEntriesByName&&performance.getEntriesByName("first-contentful-paint")[0],m=s?null:a("paint",f);(s||m)&&(n=u(e,o,t),s&&f(s),c((function(i){o=r("FCP"),n=u(e,o,t),requestAnimationFrame((function(){requestAnimationFrame((function(){o.value=performance.now()-i.timeStamp,n(!0);}));}));})));},d=!1,l=-1,h=function(e,t){d||(p$1((function(e){l=e.value;})),d=!0);var n,i=function(t){l>-1&&e(t);},f=r("CLS",0),s=0,m=[],v=function(e){if(!e.hadRecentInput){var t=m[0],i=m[m.length-1];s&&e.startTime-i.startTime<1e3&&e.startTime-t.startTime<5e3?(s+=e.value,m.push(e)):(s=e.value,m=[e]),s>f.value&&(f.value=s,f.entries=m,n());}},h=a("layout-shift",v);h&&(n=u(i,f,t),o((function(){h.takeRecords().map(v),n(!0);})),c((function(){s=0,l=-1,f=r("CLS",0),n=u(i,f,t);})));},g={passive:!0,capture:!0},y=new Date,T=function(i,r){e||(e=r,t=i,n=new Date,S(removeEventListener),E());},E=function(){if(t>=0&&t<n-y){var r={entryType:"first-input",name:e.type,target:e.target,cancelable:e.cancelable,startTime:e.timeStamp,processingStart:e.timeStamp+t};i.forEach((function(e){e(r);})),i=[];}},w=function(e){if(e.cancelable){var t=(e.timeStamp>1e12?new Date:performance.now())-e.timeStamp;"pointerdown"==e.type?function(e,t){var n=function(){T(e,t),r();},i=function(){r();},r=function(){removeEventListener("pointerup",n,g),removeEventListener("pointercancel",i,g);};addEventListener("pointerup",n,g),addEventListener("pointercancel",i,g);}(t,e):T(t,e);}},S=function(e){["mousedown","keydown","touchstart","pointerdown"].forEach((function(t){return e(t,w,g)}));},L=function(n,f){var s,m=v(),p=r("FID"),d=function(e){e.startTime<m.firstHiddenTime&&(p.value=e.processingStart-e.startTime,p.entries.push(e),s(!0));},l=a("first-input",d);s=u(n,p,f),l&&o((function(){l.takeRecords().map(d),l.disconnect();}),!0),l&&c((function(){var a;p=r("FID"),s=u(n,p,f),i=[],t=-1,e=null,S(addEventListener),a=d,i.push(a),E();}));},b={},F=function(e,t){var n,i=v(),f=r("LCP"),s=function(e){var t=e.startTime;t<i.firstHiddenTime&&(f.value=t,f.entries.push(e)),n();},m=a("largest-contentful-paint",s);if(m){n=u(e,f,t);var p=function(){b[f.id]||(m.takeRecords().map(s),m.disconnect(),b[f.id]=!0,n(!0));};["keydown","click"].forEach((function(e){addEventListener(e,p,{once:!0,capture:!0});})),o(p,!0),c((function(i){f=r("LCP"),n=u(e,f,t),requestAnimationFrame((function(){requestAnimationFrame((function(){f.value=performance.now()-i.timeStamp,b[f.id]=!0,n(!0);}));}));}));}},P=function(e){var t,n=r("TTFB");t=function(){try{var t=performance.getEntriesByType("navigation")[0]||function(){var e=performance.timing,t={entryType:"navigation",startTime:0};for(var n in e)"navigationStart"!==n&&"toJSON"!==n&&(t[n]=Math.max(e[n]-e.navigationStart,0));return t}();if(n.value=n.delta=t.responseStart,n.value<0||n.value>performance.now())return;n.entries=[t],e(n);}catch(e){}},"complete"===document.readyState?setTimeout(t,0):addEventListener("pageshow",t);};

const instanceOfAny = (object, constructors) => constructors.some((c) => object instanceof c);

let idbProxyableTypes;
let cursorAdvanceMethods;
// This is a function to prevent it throwing up in node environments.
function getIdbProxyableTypes() {
    return (idbProxyableTypes ||
        (idbProxyableTypes = [
            IDBDatabase,
            IDBObjectStore,
            IDBIndex,
            IDBCursor,
            IDBTransaction,
        ]));
}
// This is a function to prevent it throwing up in node environments.
function getCursorAdvanceMethods() {
    return (cursorAdvanceMethods ||
        (cursorAdvanceMethods = [
            IDBCursor.prototype.advance,
            IDBCursor.prototype.continue,
            IDBCursor.prototype.continuePrimaryKey,
        ]));
}
const cursorRequestMap = new WeakMap();
const transactionDoneMap = new WeakMap();
const transactionStoreNamesMap = new WeakMap();
const transformCache = new WeakMap();
const reverseTransformCache = new WeakMap();
function promisifyRequest(request) {
    const promise = new Promise((resolve, reject) => {
        const unlisten = () => {
            request.removeEventListener('success', success);
            request.removeEventListener('error', error);
        };
        const success = () => {
            resolve(wrap(request.result));
            unlisten();
        };
        const error = () => {
            reject(request.error);
            unlisten();
        };
        request.addEventListener('success', success);
        request.addEventListener('error', error);
    });
    promise
        .then((value) => {
        // Since cursoring reuses the IDBRequest (*sigh*), we cache it for later retrieval
        // (see wrapFunction).
        if (value instanceof IDBCursor) {
            cursorRequestMap.set(value, request);
        }
        // Catching to avoid "Uncaught Promise exceptions"
    })
        .catch(() => { });
    // This mapping exists in reverseTransformCache but doesn't doesn't exist in transformCache. This
    // is because we create many promises from a single IDBRequest.
    reverseTransformCache.set(promise, request);
    return promise;
}
function cacheDonePromiseForTransaction(tx) {
    // Early bail if we've already created a done promise for this transaction.
    if (transactionDoneMap.has(tx))
        return;
    const done = new Promise((resolve, reject) => {
        const unlisten = () => {
            tx.removeEventListener('complete', complete);
            tx.removeEventListener('error', error);
            tx.removeEventListener('abort', error);
        };
        const complete = () => {
            resolve();
            unlisten();
        };
        const error = () => {
            reject(tx.error || new DOMException('AbortError', 'AbortError'));
            unlisten();
        };
        tx.addEventListener('complete', complete);
        tx.addEventListener('error', error);
        tx.addEventListener('abort', error);
    });
    // Cache it for later retrieval.
    transactionDoneMap.set(tx, done);
}
let idbProxyTraps = {
    get(target, prop, receiver) {
        if (target instanceof IDBTransaction) {
            // Special handling for transaction.done.
            if (prop === 'done')
                return transactionDoneMap.get(target);
            // Polyfill for objectStoreNames because of Edge.
            if (prop === 'objectStoreNames') {
                return target.objectStoreNames || transactionStoreNamesMap.get(target);
            }
            // Make tx.store return the only store in the transaction, or undefined if there are many.
            if (prop === 'store') {
                return receiver.objectStoreNames[1]
                    ? undefined
                    : receiver.objectStore(receiver.objectStoreNames[0]);
            }
        }
        // Else transform whatever we get back.
        return wrap(target[prop]);
    },
    set(target, prop, value) {
        target[prop] = value;
        return true;
    },
    has(target, prop) {
        if (target instanceof IDBTransaction &&
            (prop === 'done' || prop === 'store')) {
            return true;
        }
        return prop in target;
    },
};
function replaceTraps(callback) {
    idbProxyTraps = callback(idbProxyTraps);
}
function wrapFunction(func) {
    // Due to expected object equality (which is enforced by the caching in `wrap`), we
    // only create one new func per func.
    // Edge doesn't support objectStoreNames (booo), so we polyfill it here.
    if (func === IDBDatabase.prototype.transaction &&
        !('objectStoreNames' in IDBTransaction.prototype)) {
        return function (storeNames, ...args) {
            const tx = func.call(unwrap(this), storeNames, ...args);
            transactionStoreNamesMap.set(tx, storeNames.sort ? storeNames.sort() : [storeNames]);
            return wrap(tx);
        };
    }
    // Cursor methods are special, as the behaviour is a little more different to standard IDB. In
    // IDB, you advance the cursor and wait for a new 'success' on the IDBRequest that gave you the
    // cursor. It's kinda like a promise that can resolve with many values. That doesn't make sense
    // with real promises, so each advance methods returns a new promise for the cursor object, or
    // undefined if the end of the cursor has been reached.
    if (getCursorAdvanceMethods().includes(func)) {
        return function (...args) {
            // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
            // the original object.
            func.apply(unwrap(this), args);
            return wrap(cursorRequestMap.get(this));
        };
    }
    return function (...args) {
        // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
        // the original object.
        return wrap(func.apply(unwrap(this), args));
    };
}
function transformCachableValue(value) {
    if (typeof value === 'function')
        return wrapFunction(value);
    // This doesn't return, it just creates a 'done' promise for the transaction,
    // which is later returned for transaction.done (see idbObjectHandler).
    if (value instanceof IDBTransaction)
        cacheDonePromiseForTransaction(value);
    if (instanceOfAny(value, getIdbProxyableTypes()))
        return new Proxy(value, idbProxyTraps);
    // Return the same value back if we're not going to transform it.
    return value;
}
function wrap(value) {
    // We sometimes generate multiple promises from a single IDBRequest (eg when cursoring), because
    // IDB is weird and a single IDBRequest can yield many responses, so these can't be cached.
    if (value instanceof IDBRequest)
        return promisifyRequest(value);
    // If we've already transformed this value before, reuse the transformed value.
    // This is faster, but it also provides object equality.
    if (transformCache.has(value))
        return transformCache.get(value);
    const newValue = transformCachableValue(value);
    // Not all types are transformed.
    // These may be primitive types, so they can't be WeakMap keys.
    if (newValue !== value) {
        transformCache.set(value, newValue);
        reverseTransformCache.set(newValue, value);
    }
    return newValue;
}
const unwrap = (value) => reverseTransformCache.get(value);

/**
 * Open a database.
 *
 * @param name Name of the database.
 * @param version Schema version.
 * @param callbacks Additional callbacks.
 */
function openDB(name, version, { blocked, upgrade, blocking, terminated } = {}) {
    const request = indexedDB.open(name, version);
    const openPromise = wrap(request);
    if (upgrade) {
        request.addEventListener('upgradeneeded', (event) => {
            upgrade(wrap(request.result), event.oldVersion, event.newVersion, wrap(request.transaction));
        });
    }
    if (blocked)
        request.addEventListener('blocked', () => blocked());
    openPromise
        .then((db) => {
        if (terminated)
            db.addEventListener('close', () => terminated());
        if (blocking)
            db.addEventListener('versionchange', () => blocking());
    })
        .catch(() => { });
    return openPromise;
}

const readMethods = ['get', 'getKey', 'getAll', 'getAllKeys', 'count'];
const writeMethods = ['put', 'add', 'delete', 'clear'];
const cachedMethods = new Map();
function getMethod(target, prop) {
    if (!(target instanceof IDBDatabase &&
        !(prop in target) &&
        typeof prop === 'string')) {
        return;
    }
    if (cachedMethods.get(prop))
        return cachedMethods.get(prop);
    const targetFuncName = prop.replace(/FromIndex$/, '');
    const useIndex = prop !== targetFuncName;
    const isWrite = writeMethods.includes(targetFuncName);
    if (
    // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
    !(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) ||
        !(isWrite || readMethods.includes(targetFuncName))) {
        return;
    }
    const method = async function (storeName, ...args) {
        // isWrite ? 'readwrite' : undefined gzipps better, but fails in Edge :(
        const tx = this.transaction(storeName, isWrite ? 'readwrite' : 'readonly');
        let target = tx.store;
        if (useIndex)
            target = target.index(args.shift());
        // Must reject if op rejects.
        // If it's a write operation, must reject if tx.done rejects.
        // Must reject with op rejection first.
        // Must resolve with op value.
        // Must handle both promises (no unhandled rejections)
        return (await Promise.all([
            target[targetFuncName](...args),
            isWrite && tx.done,
        ]))[0];
    };
    cachedMethods.set(prop, method);
    return method;
}
replaceTraps((oldTraps) => ({
    ...oldTraps,
    get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
    has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop),
}));

/*
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

function get(key) {
  let value;
  try {
    value = JSON.parse(localStorage.getItem(key));
  } catch (error) {
    // Do nothing.
  }
  return value || {};
}

function set(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch (error) {
    // Do nothing.
  }
}

const clientId = "56950733707-uq98bdfo4vvi6j38gujus6eca5eqlv8k.apps.googleusercontent.com";

let client;

function checkAuthStatus() {
  // This is set on the window in `index.html`.
  console.log("diff", get('expireAt'), Date.now(), get('expireAt') - Date.now()); 
  if (Object.keys(get("token")).length) {
    return get("expireAt") < Date.now() ? false : true;
  } else {
    return false;
  }
}

// Can only be called if the user is signed in.
function getAccessToken() {
  return get("token");
}

function signIn() {
  client.requestAccessToken();
}

async function signOut(handleSignInChange) {
  localStorage.removeItem("token");
  handleSignInChange(false);
}

function signInCallback(handleSignInChange) {
  client = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    callback: (response) => {
      if (response.error) {
        console.log(response.error);
      } else {
        set("token", response.access_token);
        set("expireAt", Date.now() + Number(response.expires_in) * 1000);
        handleSignInChange(true);
      }
    },
  });
}

/*
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class Progress {
  init(onChange) {
    this._total = 0;
    this._cur = 0;

    this._percentage = 0;
    this._startTime = performance.now();
    this._timeout;

    this._onChange = () => {
      clearTimeout(this._timeout);
      if (performance.now() > this._startTime + 1000) {
        onChange();
      } else {
        this._timeout = setTimeout(onChange, 1000);
      }
    };
  }

  get percentage() {
    return this._percentage;
  }

  get cur() {
    return this._cur;
  }

  set cur(val) {
    this._cur = val;
    this._updatePercentage();
  }

  get total() {
    return this._total;
  }

  set total(val) {
    this._total = val;
    this._updatePercentage();
  }

  _updatePercentage() {
    // Cap the % at 99 to account for chart render time.
    const pct = Math.min(99, Math.floor(this._cur * 100 / this._total));
    this._percentage = Math.max(this._percentage, pct);
    this._onChange();
  }
}

const progress = new Progress();

/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const errorMap = {
  'no_web_vitals_events': {
    title: 'No Web Vitals events found...',
    message: [
      'This report does not contain any Web Vitals event data. Make sure',
      'the account selected received Web Vitals events for the date range and',
      'and configuration options selected. You can learn how to measure and',
      'send Web Vitals data here: https://github.com/GoogleChrome/web-vitals',
    ].join(' '),
  },
  'row_limit_exceeded': {
    title: 'Sorry, cannot create report...',
    message: [
      'This account contains more than 1 million Web Vitals events per',
      'day, which is the maximum that can be reported on using the API.',
    ].join(' '),
  },
  'unsupported_filter_expression': {
    title: 'Unsupported filter expression...',
    message: [
      'OR based filter expressions (using a comma) are not supported.',
      'Only AND based filter expressions (using a semicolon) are allowed.',
    ].join(' '),
  },
  'invalid_filter_expression': {
    title: 'Invalid filter expression...',
    message: [
      'Filter expression "%s" is not valid. See:',
      'https://github.com/GoogleChromeLabs/web-vitals-report#filter-reference',
    ].join(' '),
  },
  'unexpected_metric': {
    title: 'Unexpected metric',
    message: 'The report contained a metric named "%s", which is not a valid.',
  },
};

class WebVitalsError extends Error {
  constructor(code, ...params) {
    let {title, message} = errorMap[code];

    for (const param of params) {
      message = message.replace(/%s/, param);
    }

    super(message);
    this.title = title;
    this.code = code;
  }
}

/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


const MANAGEMENT_API_URL =
    'https://www.googleapis.com/analytics/v3/management/';

const REPORTING_API_URL =
    'https://analyticsreporting.googleapis.com/v4/reports:batchGet';


const PAGE_SIZE = 100000;

const cacheableRows = new WeakSet();

function getAuthHeaders() {
  return {
    'authorization': `Bearer ${getAccessToken()}`,
  };
}

async function makeManagementAPIRequest(method) {
  let rows = [];
  let responseJSON;
  let url = MANAGEMENT_API_URL + method;

  do {
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    responseJSON = await response.json();
    rows = rows.concat(responseJSON.items);
  } while (url = responseJSON.nextLink);

  return rows;
}

function getAccountSummaries() {
  return makeManagementAPIRequest('accountSummaries');
}

let segments;
const segmentMap = new Map();

async function getSegments() {
  if (!segments) {
    segments = await makeManagementAPIRequest('segments');

    for (const segment of segments) {
      // Rename the "Desktop and Tablet Traffic" segment to "Desktop Traffic"
      // for consistency with CrUX and PSI.
      if (segment.name === 'Tablet and Desktop Traffic') {
        segment.name = 'Desktop Traffic';
      }

      // segment.name = sanitizeSegmentName(segment.name);
      segmentMap.set(segment.id, segment.name);
    }
  }
  return segments;
}

/**
 * Note: must not be used before a call to `getSegments()` finishes.
 * @param {string} id
 */
function getSegmentNameById(id) {
  return segmentMap.get(id);
}

/**
 * Multiple segments can have the same name, so we can't just search through
 * all the segments the user has access to, we have to limit the search to
 * just the segments in the `reportRequest` object.
 * @param {*} segmentName
 * @param {*} reportRequest
 * @return {string|null}
 */
function getSegmentIdByName(segmentName, reportRequest) {
  // Rename the "Desktop and Tablet Traffic" segment to "Desktop Traffic"
  // for consistency with CrUX and PSI.
  if (segmentName === 'Tablet and Desktop Traffic') {
    return '-15';
  }

  for (const segment of reportRequest.segments) {
    const segmentId = segment.segmentId.slice(6); // Remove the `gaid::`.
    if (getSegmentNameById(segmentId) === segmentName) {
      return segmentId;
    }
  }
  // Still here? It could be because the user has changed the name of the
  // segment in GA since this data was cached. In that case, return null
  // and require the data to be re-fetched.
  return null;
}

class SamplingError extends Error {}

class CacheReadError extends Error {
  constructor(error) {
    super(error.message);
    this.originalError = error;
  }
}

let originalReportRequest;
let originalStartDate;
let originalEndDate;

async function getReport(reportRequest) {
  originalReportRequest = reportRequest;
  originalStartDate = reportRequest.dateRanges[0].startDate;
  originalEndDate = reportRequest.dateRanges[0].endDate;

  let controller = new AbortController();

  try {
    // Sampled responses are never stored in the cached, so for sampled
    // requests there's no need to check there first.
    if (reportRequest.samplingLevel !== 'SMALL') {
      // If any errors are thrown getting
      try {
        return await getReportFromCacheAndAPI(reportRequest, controller);
      }
      catch (error) {
        if (error instanceof CacheReadError) {
          handleDBError(error.originalError);
        } else {
          throw error;
        }
      }
    }
    return await getReportFromAPI(reportRequest, controller);
  } catch (error) {
    if (error instanceof SamplingError) {
      const sampledReportRequest =
          JSON.parse(JSON.stringify(originalReportRequest));

      // Create a new controller for this new report.
      controller = new AbortController();

      sampledReportRequest.samplingLevel = 'SMALL';

      return await getReportFromAPI(sampledReportRequest, controller);
    } else {
      // Rethrow all errors that are not sampling errors.
      throw error;
    }
  }
}

// Technically it's 10, but we're making it lower just to be safe and account
// for requests from other tools happening at the same time.
// https://developers.google.com/analytics/devguides/reporting/core/v4/limits-quotas
const MAX_CONCURRENT_REQUESTS = 7;

let concurrentRequests = 0;
function incrementConcurrentRequests() {
  concurrentRequests++;
}

const pendingRequestDeferreds = [];
function decrementConcurrentRequests() {
  concurrentRequests--;
  if (pendingRequestDeferreds.length) {
    const deferred = pendingRequestDeferreds.pop();
    deferred.resolve();
  }
}

function concurrentRequestsCountLessThanMax() {
  if (concurrentRequests <= MAX_CONCURRENT_REQUESTS) {
    return;
  }
  const deferred = new Deferred();
  pendingRequestDeferreds.push(deferred);
  return deferred.promise;
}

async function makeReportingAPIRequest(reportRequest, signal) {
  try {
    incrementConcurrentRequests();
    await concurrentRequestsCountLessThanMax();

    const response = await fetch(REPORTING_API_URL, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        reportRequests: [reportRequest],
      }),
      signal,
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(`${json.error.code}: ${json.error.message}`);
    }
    return json.reports[0];
  } finally {
    decrementConcurrentRequests();
  }
}

async function getReportFromAPI(reportRequest, controller) {
  const rows = await getReportRowsFromAPI(reportRequest, controller);
  const isSampled = reportRequest.samplingLevel === 'SMALL';
  const source = sourcesNameMap[sources.NETWORK];
  return {rows, meta: {source, isSampled}};
}

async function getReportRowsFromAPI(reportRequest, controller) {
  let report;
  let rows = [];

  const segmentDimensionIndex =
      reportRequest.dimensions.findIndex((dim) => dim.name === 'ga:segment');

  const {startDate, endDate} = reportRequest.dateRanges[0];
  const datesInRange = getDatesInRange(startDate, endDate);

  // For non-sampled, multi-day requests that contain today or yesterday,
  // split it up since this report data will likely not be "golden".
  if (endDate != startDate && reportRequest.samplingLevel !== 'SMALL') {
    const yesterday = dateOffset(-1);
    const today = dateOffset(0);
    if (startDate < yesterday && endDate >= yesterday) {
      const dateRanges = [
        {startDate: startDate, endDate: dateOffset(-2)},
        {startDate: yesterday, endDate: yesterday},
      ];
      // If the date range includes the current day, request that separately.
      if (endDate >= today) {
        dateRanges.push({startDate: today, endDate: endDate});
      }
      return await getReportRowsByDatesFromAPI(
          reportRequest, dateRanges, controller);
    }
  }

  progress.total += datesInRange.length;

  try {
    report = await makeReportingAPIRequest(reportRequest, controller.signal);
  } catch (error) {
    // If there is an error, abort all in-progress requests for this report.
    controller.abort();

    // Rethrow the error unless it's an AbortError.
    if (error.name !== 'AbortError') {
      throw error;
    }
  }

  const totalRows = report.data.rowCount;

  const {samplesReadCounts, samplingSpaceSizes} = report.data;
  const sampleRate = samplesReadCounts &&
      (samplesReadCounts[0] / samplingSpaceSizes[0]);

  // True if the report is sampled at all.
  const isSampled = Boolean(sampleRate);

  // True if the report is sampled for a request
  // that didn't specifically ask for sampled results.
  const isAutoSampled = isSampled && reportRequest.samplingLevel !== 'SMALL';

  // If the report is a multi-day report that contains sampled data or more
  // than a million rows, trying breaking it up into one report for each day.
  if (startDate !== endDate && (isAutoSampled || totalRows >= 1e6)) {
    // Deduct the dates in range from the progress total because they're not
    // going to be used. Defer this action to ensure the percentage can
    // increase at a stable rate.
    setTimeout(() => progress.total -= datesInRange.length, 0);

    const dateRanges = datesInRange.map((d) => ({startDate: d, endDate: d}));
    return await getReportRowsByDatesFromAPI(
        reportRequest, dateRanges, controller);
  }

  // If this is a single-day request that's part of a larger report and
  // the results are sampled, throw an error because we can't mixed sample
  // data from one data with sampled data from another day.
  if (isAutoSampled && startDate === endDate &&
      originalStartDate !== originalEndDate) {
    progress.total -= datesInRange.length;
    controller.abort();
    throw new SamplingError();
  }

  // If the response still contains more than 1M rows (even after a retry),
  // throw an error because Google Analytics will truncate all responses
  // with than 1M rows, making the data useless.
  if (totalRows >= 1e6) {
    throw new WebVitalsError('row_limit_exceeded');
  }

  if (report.data.rows) {
    rows = rows.concat(report.data.rows);
  }

  // Queue adding the completed requests to progress until after any
  // paginated requests start.
  setTimeout(() => progress.cur += datesInRange.length, 0);

  // If the response shows a paginated report, fetch the rest in parallel.
  if (report.nextPageToken) {
    let rowCount = rows && rows.length || 0;
    const reportRequests = [];
    while (rowCount < totalRows) {
      const nextReportRequest = JSON.parse(JSON.stringify(reportRequest));
      nextReportRequest.pageToken = String(rowCount);
      reportRequests.push(nextReportRequest);
      rowCount += PAGE_SIZE;
    }

    progress.total += reportRequests.length;

    const pageResults = await Promise.all(reportRequests.map((req) => {
      return makeReportingAPIRequest(req).then((result) => {
        progress.cur++;
        return result;
      });
    }));

    for (const page of pageResults) {
      if (page.data.rows) {
        rows = rows.concat(page.data.rows);
      }
    }
  }

  for (const row of rows) {
    // If the data in the report is "golden" and not sampled, mark it cacheable.
    if (report.data.isDataGolden && !isSampled) {
      cacheableRows.add(row);
    }

    // If the report contains sampled data, Google Analytics will automatically
    // adjust all metric values by the sample rate. In most cases, this is what
    // you want (e.g. if you're reporting total values), but since we're going
    // to be constructing a distribution from these values, we want to the
    // original values as sent.
    if (isSampled) {
      const value = row.metrics[0].values[0];
      row.metrics[0].values[0] = `${Math.round(value * sampleRate)}`;
    }

    // The Reporting API will return the segment name, which is problematic
    // since we're going to be caching the data by segment, and users can change
    // the segment name in GA. Instead, use the segment ID.
    if (segmentDimensionIndex > -1) {
      const segmentId = getSegmentIdByName(
          row.dimensions[segmentDimensionIndex], reportRequest);

      row.dimensions[segmentDimensionIndex] = segmentId;
    }
  }

  return rows;
}

let dbPromise;
addEventListener('pageshow', () => dbPromise = getDB());
addEventListener('pagehide', () => dbPromise.then((db) => db && db.close()));

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB('web-vitals-cache', 3, {
      async upgrade(db, oldVersion, newVersion, transaction) {
        switch (oldVersion) {
          case 0:
            db.createObjectStore('data', {
              keyPath: ['viewId', 'segmentId', 'optsHash', 'date'],
            });
            break;
          case 1:
          case 2:
            // Due to bugs in v1-2, clear all data in the object store
            // because it could be incorrect in some cases.
            await transaction.objectStore('data').clear();
        }
      },
      async blocking() {
        if (dbPromise) {
          const db = await dbPromise;
          db.close();
          dbPromise = null;
        }
      }
    });
  }
  return dbPromise;
}

async function handleDBError(error) {
  measureCaughtError(error);
  if (dbPromise) {
    const db = await dbPromise;
    await db.clear('data');
  }
}

async function getCacheKeys(viewId, segmentId, optsHash, startDate, endDate) {
  const db = await getDB();
  const range = IDBKeyRange.bound(
    [viewId, segmentId, optsHash, startDate],
    [viewId, segmentId, optsHash, endDate],
  );
  return await db.getAllKeys('data', range);
}

async function updateCachedData(viewId, optsHash, rows) {
  const dateData = new Map();
  for (const row of rows) {
    // Only cache rows from reports with "golden" data.
    if (!cacheableRows.has(row)) {
      continue;
    }

    const [segmentId, date] = row.dimensions;

    let segmentData = dateData.get(date);
    if (!segmentData) {
      segmentData = new Map();
      dateData.set(date, segmentData);
    }

    let rowData = segmentData.get(segmentId);
    if (!rowData) {
      rowData = [];
      segmentData.set(segmentId, rowData);
    }

    rowData.push(row);
  }

  const db = await getDB();
  for (const [date, segmentData] of dateData) {
    for (const [segmentId, rows] of segmentData) {
      // An empty set of rows should never exist, but just in case...
      if (rows.length) {
        await db.put('data', {
          viewId,
          segmentId,
          optsHash,
          date: toISODate(date),
          json: JSON.stringify(rows),
        });
      }
    }
  }
}

const sources = {
  CACHE: 1,
  NETWORK: 2,
  MIXED: 3,
};

const sourcesNameMap = Object.fromEntries(
    Object.entries(sources).map(([k, v]) => [v, k.toLowerCase()]));

async function getReportFromCacheAndAPI(reportRequest, controller) {
  const {viewId, segments, dimensions, dimensionFilterClauses} = reportRequest;
  const {startDate, endDate} = reportRequest.dateRanges[0];
  const optsHash = await hashObj({dimensions, dimensionFilterClauses});

  let foundKeys = [];
  try {
    foundKeys = await Promise.all(segments.map(({segmentId}) => {
      return getCacheKeys(
          viewId, segmentId.slice(6), optsHash, startDate, endDate);
    }));
  } catch (error) {
    handleDBError(error);
  }

  let usableKeys = [];
  const cachedDates = {};
  for (const key of foundKeys.flat()) {
    const date = key[3];
    cachedDates[date] = cachedDates[date] || [];
    cachedDates[date].push(key);

    // If there's a cache key for all needed segments, they are usable.
    if (cachedDates[date].length === segments.length) {
      usableKeys = usableKeys.concat(cachedDates[date]);
    }
  }

  let missingRanges = getMissingRanges(reportRequest, cachedDates);

  // If the average number of rows per day from the previous report for this
  // view is > 100,000 then just start off by requesting per-day data.
  const {avgRowsPerDay} = get(`meta:${viewId}`);
  if (avgRowsPerDay > 1e5) {
    let perDayMissingRanges = [];
    for (const {startDate, endDate} of missingRanges) {
      const datesInRange = getDatesInRange(startDate, endDate);
      perDayMissingRanges = perDayMissingRanges.concat(
          datesInRange.map((d) => ({startDate: d, endDate: d})));
    }
    missingRanges = perDayMissingRanges;
  }

  const [networkReport, cachedReport] = await Promise.all([
    getReportRowsByDatesFromAPI(reportRequest, missingRanges, controller),
    getCachedData(usableKeys),
  ]);

  const rows = mergeReportRows(cachedReport, networkReport);
  const source = sourcesNameMap[
      (missingRanges.length ? sources.NETWORK : 0) +
      (cachedReport.length ? sources.CACHE : 0)];

  // Don't await.
  updateCachedData(viewId, optsHash, networkReport).catch(handleDBError);

  return {rows, meta: {source}};
}

async function getCachedData(usableKeys) {
  // Start by populating the report with all available cached data
  // for the segments and dates specified.
  let cachedReport = [];
  let didError = false;

  try {
    progress.total += usableKeys.length;
    const db = await getDB();
    await Promise.all(usableKeys.map((key, i) => {
      return db.get('data', key).then((value) => {
        progress.cur++;
        if (!didError) {
          cachedReport = mergeReportRows(cachedReport, JSON.parse(value.json));
        }
      });
    }));
  } catch (error) {
    didError = true;
    throw new CacheReadError(error);
  }
  return cachedReport;
}

function getMissingRanges(reportRequest, cacheDates = {}) {
  const {startDate, endDate} = reportRequest.dateRanges[0];

  const missingRanges = [];
  let missingRangeStart;
  let missingRangeEnd;

  getDatesInRange(startDate, endDate).forEach((date, i, range) => {
    const missingDateData =
        cacheDates[date]?.length !== reportRequest.segments.length;

    if (missingDateData) {
      if (!missingRangeStart) {
        missingRangeStart = date;
      }
      missingRangeEnd = date;
    }

    if (!missingDateData || i === range.length - 1) {
      if (missingRangeStart && missingRangeEnd) {
        missingRanges.push({
          startDate: missingRangeStart,
          endDate: missingRangeEnd,
        });
        missingRangeStart = missingRangeEnd = null;
      }
    }
  });
  return missingRanges;
}

async function getReportRowsByDatesFromAPI(
    reportRequest, dateRanges, controller) {
  const rows = await Promise.all(
    dateRanges.map(async (dateRange) => {
      const newReportRequest =
          getReportRequestForDates(reportRequest, dateRange);

      return await getReportRowsFromAPI(newReportRequest, controller);
    }),
  );

  return rows.reduce((prev, next) => mergeReportRows(prev, next), []);
}

function getReportRequestForDates(reportRequest, dateRange) {
  const reportRequestClone = JSON.parse(JSON.stringify(reportRequest));
  reportRequestClone.dateRanges = [dateRange];

  return reportRequestClone;
}

function mergeReportRows(r1, r2) {
  // If either of the reportData objects are undefined, return the other.
  if (!(r1 && r2)) return r1 || r2;

  return mergeSortedArrays(r1, r2, (r) => Number(r.metrics[0].values[0]));
}

/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const getConfig = (id) => {
  const config = {
    measurement_version: "8",
    page_path: location.pathname,
  };

  if (id.startsWith("UA-")) {
    Object.assign(config, {
      transport_type: "beacon",
      custom_map: {
        dimension1: "measurement_version",
        dimension2: "client_id",
        dimension3: "segments",
        dimension4: "config",
        dimension5: "report_source",
        dimension6: "debug_target",
        dimension7: "metric_rating",
        metric1: "report_size",
      },
    });
  }
  if (id.startsWith("G-")) {
    if (location.hostname !== "web-vitals-report.web.app") {
      config.debug_mode = true;
    }
  }
  return ["config", id, config];
};

const thresholds = {
  CLS: [0.1, 0.25],
  FCP: [1800, 3000],
  FID: [100, 300],
  LCP: [2500, 4000],
  TTFB: [800, 1800],
};

function getRating(value, thresholds) {
  if (value > thresholds[1]) {
    return "poor";
  }
  if (value > thresholds[0]) {
    return "ni";
  }
  return "good";
}

function getSelector(node, maxLen = 100) {
  let sel = "";
  try {
    while (node && node.nodeType !== 9) {
      const part = node.id
        ? "#" + node.id
        : node.nodeName.toLowerCase() +
          (node.className && node.className.length
            ? "." + Array.from(node.classList.values()).join(".")
            : "");
      if (sel.length + part.length > maxLen - 1) return sel || part;
      sel = sel ? part + ">" + sel : part;
      if (node.id) break;
      node = node.parentNode;
    }
  } catch (err) {
    // Do nothing...
  }
  return sel;
}

function getLargestLayoutShiftEntry(entries) {
  return entries.reduce((a, b) => (a && a.value > b.value ? a : b));
}

function getLargestLayoutShiftSource(sources) {
  return sources.reduce((a, b) => {
    return a.node &&
      a.previousRect.width * a.previousRect.height >
        b.previousRect.width * b.previousRect.height
      ? a
      : b;
  });
}

function wasFIDBeforeDCL(fidEntry) {
  const navEntry = performance.getEntriesByType("navigation")[0];
  return navEntry && fidEntry.startTime < navEntry.domContentLoadedEventStart;
}

function getDebugInfo(name, entries = []) {
  // In some cases there won't be any entries (e.g. if CLS is 0,
  // or for LCP after a bfcache restore), so we have to check first.
  if (entries.length) {
    if (name === "LCP") {
      const lastEntry = entries[entries.length - 1];
      return {
        debug_target: getSelector(lastEntry.element),
        event_time: lastEntry.startTime,
      };
    } else if (name === "FID") {
      const firstEntry = entries[0];
      return {
        debug_target: getSelector(firstEntry.target),
        debug_event: firstEntry.name,
        debug_timing: wasFIDBeforeDCL(firstEntry) ? "pre_dcl" : "post_dcl",
        event_time: firstEntry.startTime,
      };
    } else if (name === "CLS") {
      const largestEntry = getLargestLayoutShiftEntry(entries);
      if (largestEntry && largestEntry.sources && largestEntry.sources.length) {
        const largestSource = getLargestLayoutShiftSource(largestEntry.sources);
        if (largestSource) {
          return {
            debug_target: getSelector(largestSource.node),
            event_time: largestEntry.startTime,
          };
        }
      }
    }
  }
  // Return default/empty params in case there are no entries.
  return {
    debug_target: "(not set)",
  };
}

function handleMetric({ name, value, delta, id, entries }) {
  const params = {
    value: Math.round(name === "CLS" ? delta * 1000 : delta),
    event_category: "Web Vitals",
    event_label: id,
    metric_value: value,
    metric_delta: delta,
    metric_rating: getRating(value, thresholds[name]),
    non_interaction: true,
    ...getDebugInfo(name, entries),
  };

  if (name === "TTFB" && entries.length) {
    const navEntry = entries[0];
    Object.assign(params, {
      fetch_start: navEntry.fetchStart,
      domain_lookup_start: navEntry.domainLookupStart,
      connect_start: navEntry.connectStart,
      request_start: navEntry.requestStart,
      response_start: navEntry.responseStart,
    });
  }

  gtag("event", name, params);
}

function measureWebVitals() {
  h(handleMetric);
  p$1(handleMetric);
  L(handleMetric);
  F(handleMetric);
  P(handleMetric);
}

function anonymizeSegment(id) {
  if (id.match(/^-\d+$/)) {
    return getSegmentNameById(id);
  } else {
    return "Custom Segment";
  }
}

function anonymizeConfig(state) {
  const opts = state[`opts:${state.viewId}`];
  if (opts && opts.active) {
    return [
      `id=${opts.metricIdDim}`,
      `name=${opts.metricNameDim}`,
      `metrics=${[
        opts.lcpName,
        opts.fidName,
        opts.clsName,
        opts.fcpName,
        opts.fftbName,
      ].join(",")}`,
      `filters=${opts.filters}`,
    ].join("|");
  }
  return "(not set)";
}

function measureReport({ state, duration, report, error }) {
  gtag("event", `report_${error ? "error" : "success"}`, {
    value: duration,
    report_size: report ? report.rows.length : 0,
    segments: [
      anonymizeSegment(state.segmentA),
      anonymizeSegment(state.segmentB),
    ]
      .sort()
      .join(", "),
    config: anonymizeConfig(state),
    event_category: "Usage",
    event_label: error ? error.code || error.message : "(not set)",
    report_source: report ? report.meta.source : "(not set)",
    report_sampled: Boolean(report && report.meta.isSampled),
  });
}

function measureCaughtError(error) {
  gtag("event", "caught_error", {
    event_category: "Usage",
    event_label: error.stack || error.toString(),
  });
}

function initAnalytics() {
  if (location.hostname !== "web-vitals-report.web.app") {
    window.gtag = console.log;
  }

  gtag("js", new Date());
  gtag(...getConfig("G-P1J6CQWJ4R"));
  gtag(...getConfig("UA-185052243-1"));

  measureWebVitals();
}

/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const COLORS = ["#aaa", "hsla(218, 88%, 50%, 0.7)"];

function bucketValues(arrayOfValues, { maxValue, bucketSize = 10 } = {}) {
  maxValue = maxValue || arrayOfValues[arrayOfValues.length - 1];

  const bucketMap = {};
  for (const value of arrayOfValues) {
    if (value > maxValue) break;

    const bucket = Math.floor(value / bucketSize) * bucketSize;
    if (!bucketMap[bucket]) {
      bucketMap[bucket] = 0;
    }
    ++bucketMap[bucket];
  }

  const bucketEntries = [];
  for (let bucket = 0; bucket < maxValue; bucket += bucketSize) {
    bucketEntries.push([String(bucket), bucketMap[bucket] || 0]);
  }

  return bucketEntries;
}

function drawHistogram({
  container,
  metric,
  dimensionValues,
  bucketSize = 20,
  maxValue = 1000,
} = {}) {
  // The `allBuckets` object is used to create the x-axis.
  const allBuckets = [];
  for (let bucket = 0; bucket < maxValue; bucket += bucketSize) {
    // Avoid floating point rounding errors.
    bucket = round(bucket, 2);
    allBuckets.push(bucket);
  }

  const dimensionBuckets = {};
  for (const [dimension, values] of Object.entries(dimensionValues)) {
    dimensionBuckets[dimension] = bucketValues(values, {
      maxValue,
      bucketSize,
    });
  }

  // Sort the dimensions to ensure series order is deterministic (otherwise
  // the colors applied to each series could change based on the data passed).
  const series = Object.keys(dimensionBuckets).map((key) => {
    return {
      type: "column",
      name: key,
      data: dimensionBuckets[key],
    };
  });

  Highcharts.chart(container, {
    title: { text: `${metric} distribution` },
    colors: COLORS,
    xAxis: [
      {
        title: { text: "Time (ms)" },
        categories: allBuckets,
        lineColor: "#9e9e9e",
      },
    ],
    yAxis: [
      {
        title: { text: "Count" },
      },
    ],
    plotOptions: {
      column: {
        grouping: false,
        pointPadding: 0,
        groupPadding: 0,
        pointPlacement: "between",
        opacity: 0.8,
      },
    },
    series,
  });
}

function drawTimeline(name, dateValues) {
  const seriesObj = {};

  for (const [date, values] of Object.entries(dateValues)) {
    const timestamp = Date.UTC(
      date.slice(0, 4),
      date.slice(4, 6) - 1,
      date.slice(6)
    );

    for (const segmentName of Object.keys(values)) {
      seriesObj[segmentName] = seriesObj[segmentName] || {
        name: segmentName,
        data: [],
      };

      const segmentValues = values[segmentName];
      if (segmentValues.length > 8) {
        seriesObj[segmentName].data = seriesObj[segmentName].data || [];
        seriesObj[segmentName].data.push([timestamp, p(75, segmentValues)]);
      }
    }
  }

  Highcharts.chart(`timeline-${name}`, {
    chart: { type: "spline" },
    colors: COLORS,
    title: { text: `${name} over time (p75)` },
    xAxis: { type: "datetime" },
    yAxis: { min: 0 },
    series: [...Object.values(seriesObj)],
  });
}

function drawWarnings(isSampled) {
  document.getElementById("report-warnings").innerHTML = isSampled
    ? `
    <aside class="Report-sampleWarning">
      <strong><i>⚠️</i> Warning:</strong>
      This report is based on a sample of the full user base.
      <a target="_blank"
        href="https://support.google.com/analytics/answer/2637192">
        Learn more.
      </a>
    </aside>
  `
    : ``;
}

function drawSummary(metric, segments) {
  const $el = document.getElementById(`summary-${metric}`);
  let html = ``;

  for (const [name, values] of Object.entries(segments)) {
    const result = p75(values);

    html += `
    <span class="Report-metricSummaryItem">
      ${e$1(name)}
      <span class="Score Score--alt Score--${score(
        metric,
        result
      )}">${result}</span>
    </span>
  `;
  }

  $el.innerHTML = html;
}

function drawTable(id, dimensionName, dimensionData, sliceIndex = 5) {
  const metricNames = Object.keys(dimensionData[0][1]);
  const segmentNames = Object.keys(dimensionData[0][1][metricNames[0]]);

  let nextSliceIndex;

  nextSliceIndex = sliceIndex + 5 > dimensionData.length ? 5 : sliceIndex + 5;

  document.getElementById(id).innerHTML = `
    <thead>
      <tr>
        <th class="Table-dimension">${e$1(dimensionName)}</th>
        <th class="Table-segment">Segment</th>
        ${metricNames
          .map((metric) => {
            return `<th class="Table-metric">${e$1(metric)}</th>`;
          })
          .join("")}
      </tr>
    </thead>
    <tbody>
      ${dimensionData
        .slice(0, sliceIndex)
        .map(([dimension, values]) => {
          return segmentNames
            .map(
              (segment, i) => `<tr>
          ${
            i === 0
              ? `<td class="Table-dimension" rowspan="2">${e$1(dimension)}</td>`
              : ""
          }
          <td class="Table-segment">${e$1(segment)}</td>
          ${metricNames
            .map((metric) => {
              const result = p75(values[metric][segment]);
              return `
              <td>
                <div class="Score Score--${score(metric, result)}">
                  ${result}
                </div>
              </td>
            `;
            })
            .join("")}
        </tr>`
            )
            .join("");
        })
        .join("")}
    </tbody>
  `;

  const showMore = document.getElementById(dimensionName + "counts");
  showMore.addEventListener("click", () =>
    drawTable(id, dimensionName, dimensionData, nextSliceIndex)
  );
  showMore.textContent = nextSliceIndex === 5 ? "Show Default" : "Show More";
}

function drawDebugInfo(pages) {
  const pageEntries = [...Object.entries(pages)].slice(0, 5);
  document.getElementById("debug").innerHTML = `
    <header>
      <h3>
        <h3 class="Report-breakdownHeading">Debug Info</h3>
        <div class="Report-breakdownMeta">By top pages</div>
      </h3>
    </header>

    ${
      pageEntries.length > 1
        ? `<nav class="DebugNav">
      <ul>
        ${pageEntries
          .map(
            ([path]) => `
          <li><a href="#${path}">${path}</a></li>
        `
          )
          .join("")}
      </ul>
    </nav>`
        : ""
    }

    ${pageEntries
      .map(
        ([path, page]) => `
      <div class="Table">
      <table>
        <tr>
          <th class="Table-debugHeader">
            <div class="Table-debugSpacer"><strong>URL Path</strong></div>
          </th>
          <th class="Table-debugHeader" colspan="4" id="${path}">${path}</th>
        </tr>
        ${["LCP", "FID", "CLS", "FCP", "TTFB"]
          .map(
            (metric) => `
          ${Object.keys(page[metric])
            .map((segment) => {
              let debugEntries = page[metric][segment].debug;
              if (debugEntries) {
                debugEntries = [...Object.entries(debugEntries)].sort(
                  (a, b) => b[1].length - a[1].length
                );

                const importantEntries = [];
                let otherValues = [];
                const count = page[metric][segment].length;

                for (let i = 0; i < debugEntries.length; i++) {
                  const [id, values] = debugEntries[i];
                  if (i < 5 && values.length / count >= 0.02) {
                    importantEntries.push([id, values]);
                  } else {
                    otherValues = otherValues.concat(values);
                  }
                }
                otherValues = otherValues.sort((a, b) => a - b);

                const totalRows =
                  importantEntries.length + Math.min(1, otherValues.length);

                return `
                <tr>
                  <th class="Table-debugMetricHeader">${metric}</th>
                  <th>Top debug identifiers</th>
                  <th class="Table-value">% of page visits</th>
                  <th class="Table-value">Count</th>
                  <th class="Table-metric">${metric}</th>
                </tr>

                ${importantEntries
                  .map(
                    ([id, values], index) => `
                  <tr>
                    ${
                      index === 0
                        ? `<td class="Table-debugSegment"
                      rowspan="${totalRows}">
                      <div class="Table-debugSpacer">${segment}</div>
                    </td>`
                        : ``
                    }
                    <td>${id}</td>
                    <td class="Table-value">
                      ${round((100 * values.length) / count, 2)}%
                    </td>
                    <td class="Table-value">${values.length}</td>
                    <td>
                      <div class="Score Score--${score(metric, p75(values))}">
                        ${p75(values)}
                      </div>
                    </td>
                  </tr>
                `
                  )
                  .join("")}
                ${
                  otherValues.length
                    ? `
                  <tr>
                    <td><em>(other)</em></td>
                    <td class="Table-value">
                      ${round((100 * otherValues.length) / count, 2)}%
                    </td>
                    <td class="Table-value">${otherValues.length}</td>
                    <td>
                      <div class="Score Score--${score(
                        metric,
                        p75(otherValues)
                      )}">
                        ${p75(otherValues)}
                      </div>
                    </td>
                  </tr>
                `
                    : ""
                }
              `;
              } else {
                return "";
              }
            })
            .join("")}
      `
          )
          .join("")}
      </table>
      </div>
    `
      )
      .join("")}
  `;
}

function score(metric, p75) {
  const thresholds = {
    LCP: [2500, 4000],
    FID: [100, 300],
    CLS: [0.1, 0.25],
    FCP: [1800, 3000],
    TTFB: [800, 1800],
    // LCP: [1100, 2000],
    // FID: [4, 10],
    // CLS: [0.1, 0.25],
  };
  if (p75 <= thresholds[metric][0]) {
    return "good";
  }
  if (p75 <= thresholds[metric][1]) {
    return "ni";
  }
  if (p75 > thresholds[metric][1]) {
    return "poor";
  }
  return "unknown";
}

function p(percentile, values) {
  return values[Math.floor(values.length * (percentile / 100))];
}

function p75(values) {
  if (values && values.length > 8) {
    return p(75, values);
  }
  return "-"; // Insufficient data
}

function renderCharts(report, reportOpts) {
  const { data, meta } = report;

  drawWarnings(meta.isSampled);

  for (const [name, metric] of Object.entries(data.metrics)) {
    let maxValue;
    let bucketSize;

    // Calculate high-percentile values to determine the histogram dimensions.
    const p95 = p(95, metric.values);
    const p98 = p(98, metric.values);

    switch (name) {
      case "LCP":
        maxValue = Math.max(Math.ceil(p98 / 1000) * 1000, 3000);

        bucketSize = 100;
        if (maxValue > 5000) {
          bucketSize = 200;
        }
        if (maxValue > 10000) {
          bucketSize = 500;
        }
        break;
      case "FID":
        maxValue = Math.max(Math.ceil(p95 / 50) * 50, 50);
        bucketSize = 1;
        if (maxValue > 100) {
          bucketSize = 2;
        }
        if (maxValue > 300) {
          bucketSize = 5;
        }
        if (maxValue > 1000) {
          bucketSize = 10;
        }
        break;
      case "CLS":
        maxValue = Math.max(Math.ceil(p95 * 10) / 10, 0.1);
        bucketSize = 0.01;
        if (maxValue > 0.3) {
          bucketSize = 0.05;
        }
        if (maxValue > 1) {
          bucketSize = 0.1;
        }
        break;
      case "FCP":
        maxValue = Math.max(Math.ceil(p98 / 1000) * 1000, 3000);

        bucketSize = 100;
        if (maxValue > 5000) {
          bucketSize = 200;
        }
        if (maxValue > 10000) {
          bucketSize = 500;
        }
        break;
      case "TTFB":
        maxValue = Math.max(Math.ceil(p98 / 1000) * 1000, 3000);

        bucketSize = 100;
        if (maxValue > 5000) {
          bucketSize = 200;
        }
        if (maxValue > 10000) {
          bucketSize = 500;
        }
        break;
    }

    drawSummary(name, metric.segments);

    drawHistogram({
      metric: name,
      container: `histogram-${name}`,
      maxValue: maxValue,
      bucketSize: bucketSize,
      dimensionValues: metric.segments,
    });

    drawTimeline(name, metric.dates);
  }

  drawTable("countries", "Country", [...Object.entries(data.countries)]);
  drawTable("pages", "Page", [...Object.entries(data.pages)]);

  // Only render the debug table if a debug dimension is set in the options.
  if (reportOpts.active && reportOpts.debugDim) {
    drawDebugInfo(data.pages);
  } else {
    document.getElementById("debug").innerHTML = "";
  }

  document.getElementById("report").hidden = false;
}

/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

async function getWebVitalsData(state, opts) {
  const reportRequest = buildReportRequest(state, opts);
  const { rows, meta } = await getReport(reportRequest);

  const metricNameMap = {
    [opts.lcpName]: "LCP",
    [opts.fidName]: "FID",
    [opts.clsName]: "CLS",
    [opts.fcpName]: "FCP",
    [opts.ttfbName]: "TTFB",
  };

  if (rows.length === 0) {
    throw new WebVitalsError("no_web_vitals_events");
  }

  const getSegmentsObj = (getDefaultValue = () => []) => {
    const segmentIdA = reportRequest.segments[0].segmentId.slice(6);
    const segmentIdB = reportRequest.segments[1].segmentId.slice(6);
    return {
      [getSegmentNameById(segmentIdA)]: getDefaultValue(),
      [getSegmentNameById(segmentIdB)]: getDefaultValue(),
    };
  };

  const getMetricsObj = (getDefaultValue = getSegmentsObj) => {
    return {
      LCP: getDefaultValue(),
      FID: getDefaultValue(),
      CLS: getDefaultValue(),
      FCP: getDefaultValue(),
      TTFB: getDefaultValue(),
    };
  };

  const incrementCount = (obj) => {
    if (!Object.prototype.hasOwnProperty.call(obj, "count")) {
      Object.defineProperty(obj, "count", { writable: true, value: 0 });
    }
    obj.count++;
  };

  const data = {
    metrics: getMetricsObj(() => {
      return { values: [], segments: getSegmentsObj(), dates: {} };
    }),
    countries: {},
    pages: {},
  };

  for (const row of rows) {
    let value = Number(row.metrics[0].values[0]);
    let [segmentId, date, metric, country, page] = row.dimensions;

    const debugId =
      opts.active && opts.debugDim
        ? row.dimensions[row.dimensions.length - 1]
        : null;

    const segment = getSegmentNameById(segmentId);

    // Convert the metric from any custom name to the standard name.
    metric = metricNameMap[metric];

    // CLS is sent to Google Analytics at 1000x for greater precision.
    if (metric === "CLS") {
      value = value / 1000;
    }

    // Even though the report limits `metric` values to LCP, FID, and CLS,
    // for reports with more than a million rows of data, Google Analytics
    // will aggregate everything after the first million rows into and "(other)"
    // bucket, which skews the data and makes the report useless.
    // The only solution to this is to make more granular requests (e.g.
    // reduce the date range or add filters) and manually combine the data
    // yourself.
    if (
      metric !== "LCP" &&
      metric !== "FID" &&
      metric !== "CLS" &&
      metric !== "FCP" &&
      metric !== "TTFB"
    ) {
      throw new WebVitalsError("unexpected_metric", metric);
    }

    const metricData = data.metrics[metric];
    metricData.values.push(value);

    // Breakdown by segment.
    metricData.segments[segment] = metricData.segments[segment] || [];
    metricData.segments[segment].push(value);

    // Breakdown by date.
    metricData.dates[date] = metricData.dates[date] || getSegmentsObj();
    metricData.dates[date][segment].push(value);

    // Breakdown by country.
    data.countries[country] = data.countries[country] || getMetricsObj();
    data.countries[country][metric][segment].push(value);
    incrementCount(data.countries[country]);

    // Breakdown by page.
    data.pages[page] = data.pages[page] || getMetricsObj();
    const pageSeg = data.pages[page][metric][segment];
    pageSeg.push(value);
    incrementCount(data.pages[page]);

    // Debug info by page.
    if (debugId) {
      pageSeg.debug = pageSeg.debug || {};
      pageSeg.debug[debugId] = pageSeg.debug[debugId] || [];
      pageSeg.debug[debugId].push(value);
      incrementCount(pageSeg.debug[debugId]);
    }
  }

  // Sort data
  function sortObjByCount(obj) {
    const newObj = {};
    const sortedKeys = Object.keys(obj).sort(
      (a, b) => obj[b].count - obj[a].count
    );

    for (const key of sortedKeys) {
      newObj[key] = obj[key];
    }
    return newObj;
  }

  // Sort data by count.
  data.countries = sortObjByCount(data.countries);
  data.pages = sortObjByCount(data.pages);

  return { data, rows, meta };
}

function parseFilters(filtersExpression) {
  if (filtersExpression.match(/[^\\],/)) {
    throw new WebVitalsError("unsupported_filter_expression");
  }

  // TODO: add support for escaping semicolons.
  return filtersExpression.split(";").map((expression) => {
    const match = /(ga:\w+)([!=][=@~])(.+)$/.exec(expression);
    if (!match) {
      throw new WebVitalsError("invalid_filter_expression", expression);
    }

    const filter = {
      dimensionName: match[1],
      expressions: [match[3]],
    };

    if (match[2].startsWith("!")) {
      filter.not = true;
    }

    if (match[2].endsWith("=")) {
      filter.operator = "EXACT";
    } else if (match[2].endsWith("@")) {
      filter.operator = "PARTIAL";
    } else if (match[3].endsWith("~")) {
      filter.operator = "REGEXP";
    }
    return filter;
  });
}

function buildReportRequest(state, opts) {
  const { viewId, startDate, endDate, segmentA, segmentB } = state;

  const dimensions = [
    { name: "ga:segment" },
    { name: "ga:date" },
    { name: opts.metricNameDim }, // Metric name (ga:eventAction)
    { name: "ga:country" },
    { name: "ga:pagePath" },
    { name: opts.metricIdDim }, // Unique metric ID (ga:eventLabel)
  ];

  if (opts.active && opts.debugDim) {
    dimensions.push({ name: opts.debugDim });
  }

  let filters = [
    {
      dimensionName: opts.metricNameDim,
      operator: "IN_LIST",
      expressions: [
        opts.lcpName,
        opts.fidName,
        opts.clsName,
        opts.fcpName,
        opts.ttfbName,
      ],
    },
  ];

  if (opts.active && opts.filters) {
    filters = filters.concat(parseFilters(opts.filters));
  }

  return {
    viewId,
    pageSize: PAGE_SIZE,
    // samplingLevel: 'SMALL',
    includeEmptyRows: true,
    dateRanges: [{ startDate, endDate }],
    segments: [
      { segmentId: `gaid::${segmentA}` },
      { segmentId: `gaid::${segmentB}` },
    ],
    metrics: [{ expression: "ga:eventValue" }],
    dimensions,
    dimensionFilterClauses: {
      operator: "AND",
      filters,
    },
    orderBys: [
      {
        fieldName: "ga:eventValue",
        sortOrder: "ASCENDING",
      },
      {
        fieldName: "ga:date",
        sortOrder: "ASCENDING",
      },
    ],
  };
}

/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

let state = {};
const listenerMap = new Map();

function initState(initializer) {
  Object.assign(state, initializer(get("state")));
  document.addEventListener("visibilitychange", () => set("state", state));
  return state;
}

function addChangeListener(key, callback) {
  let listeners = listenerMap.get(key);
  if (!listeners) {
    listeners = new Set();
    listenerMap.set(key, listeners);
  }
  listeners.add(callback);
}

function runChangeListeners(key, ...args) {
  const listeners = listenerMap.get(key);
  if (listeners) {
    for (const listener of listeners) {
      listener(...args);
    }
  }
}

function setState(updates) {
  let stateDidChange = false;
  const oldState = state;
  state = Object.assign({}, state, updates);

  for (const [key, value] of Object.entries(updates)) {
    if (oldState[key] !== value) {
      stateDidChange = true;
      runChangeListeners(key, value, oldState[key]);
    }
  }
  if (stateDidChange) {
    runChangeListeners("*");
  }
}

function getState() {
  return state;
}

/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const windowLoaded = new Promise((resolve) => {
  addEventListener("load", resolve);
});

const data = {
  dateRangeOpts: [
    ["7", "Last 7 days"],
    ["14", "Last 14 days"],
    ["28", "Last 28 days"],
    ["-1", "Custom range"],
  ],
  segmentsRecommendedOpts: [
    ["-15,-14", "Desktop Traffic vs Mobile Traffic"],
    ["-2,-3", "New Users vs. Returning Users"],
    ["-19,-12", "Bounced Sessions vs. Non-bounce Sessions"],
    ["-102,-103", "Converters vs. Non-converters"],
    ["", "Choose segments"],
  ],
};

function validateOpts(opts = {}) {
  return {
    active: false,
    metricNameDim: "ga:eventAction",
    metricIdDim: "ga:eventLabel",
    category: "Web Vitals",
    lcpName: "LCP",
    fidName: "FID",
    clsName: "CLS",
    fcpName: "FCP",
    ttfbName: "TTFB",
    filters: "",
    debugDim: "",
    ...opts,
  };
}

async function initViewOpts() {
  let { viewId } = getState();
  const viewOpts = {};
  const accountSummaries = await getAccountSummaries();

  for (const { name: accountName, webProperties } of accountSummaries) {
    if (webProperties) {
      for (const { name: propertyName, profiles } of webProperties) {
        if (profiles) {
          for (const { name: viewName, id } of profiles) {
            // If no view has been saved from a previous session,
            // the first view listed will be used.
            if (!viewId) {
              viewId = id;
              setState({ viewId });
            }

            viewOpts[accountName] = viewOpts[accountName] || [];
            viewOpts[accountName].push({
              name: `${propertyName} (${viewName})`,
              id: id,
            });
          }
        }
      }
    }
  }
  data.viewOpts = viewOpts;
  queueRender();
}

async function initSegmentOpts() {
  const segmentOpts = {
    BUILT_IN: [],
    CUSTOM: [],
  };
  const segments = await getSegments();
  for (const { type, name, id } of segments) {
    segmentOpts[type].push([id, name]);
  }

  data.segmentOpts = segmentOpts;
  queueRender();
}

function onDateRangeChange(newValue) {
  if (newValue > 0) {
    setState({
      startDate: dateOffset(-newValue),
      endDate: dateOffset(-1),
    });
  }
}

function onSegmentsRecommendedChange(newValue) {
  if (newValue) {
    const [segmentA, segmentB] = newValue.split(",");
    setState({ segmentA, segmentB });
  }
}

function onIsFetchingDataChange(newValue) {
  if (newValue === true) {
    document.body.classList.add("isFetchingData");
  } else {
    document.body.classList.remove("isFetchingData");
  }
}

function onChange({ target }) {
  if (target.id.startsWith("opts:")) {
    const field = target.id.slice(5); // After the colon.
    const state = getState();
    const value = target.type === "checkbox" ? target.checked : target.value;
    const key = `opts:${state.viewId}`;
    const opts = validateOpts(state[key]);
    opts[field] = value;
    setState({ [key]: opts });
  } else {
    setState({ [target.id]: target.value });
  }
  queueRender();
}

async function onSubmit(event) {
  event.preventDefault();

  if (!checkAuthStatus()) {
    signOut(handleSignInChange);
    alert('token expired');
    return;
  }

  // Account for cases where the user kept the tab open for more than
  // a day, so the start/end dates need to be updated.
  const { dateRange } = getState();
  if (dateRange > 0) {
    onDateRangeChange(dateRange);
  }

  const reportState = getState();
  const viewOpts = reportState[`opts:${reportState.viewId}`];
  const reportOpts = validateOpts(viewOpts && viewOpts.active ? viewOpts : {});
  const startTime = performance.now();

  let report;
  let error;

  try {
    setState({ isFetchingData: true, progress: "" });
    progress.init(() => setState({ progress: `(${progress.percentage}%)` }));

    // Ensure the Highcharts library (loaded async) is ready.
    await windowLoaded;

    const results = await Promise.all([
      getWebVitalsData(reportState, reportOpts),
      // Make the request at least 300ms long so the animation can complete.
      // If the animation ends too quickly it's not obvious anything happened.
      timeout(300),
    ]);
    report = results[0];
    renderCharts(report, reportOpts);
  } catch (requestError) {
    console.error(requestError);
    addAlert(requestError);
    error = requestError;
  } finally {
    setState({ isFetchingData: false });
    measureReport({
      state: getState(),
      duration: Math.round(performance.now() - startTime),
      report,
      error,
    });

    // Persist the average number of rows per day in the report. This is
    // used to determine whether subsequent reports should start off being
    // broken up by day.
    const { startDate, endDate, viewId } = reportState;
    const avgRowsPerDay = round(
      report.rows.length / getDatesInRange(startDate, endDate).length,
      0
    );

    set(`meta:${viewId}`, { avgRowsPerDay });
  }
}

function renderOpts(selected, options) {
  return options.map(
    ([value, name]) => html`
      <option ?selected=${selected === value} .value=${value}>${name}</option>
    `
  );
}

const app = (state, data) => {
  const opts = validateOpts(state[`opts:${state.viewId}`]);
  const showCustomDateRangeSelect = state.dateRange < 0;
  const showCustomSegmentsSelect = !state.segmentsRecommended;

  return html`
    <form class="Form" @input=${onChange} @submit=${onSubmit}>
      <div class="Form-field">
        <label>1. Select a Google Analytics account</label>
        <select id="viewId">
          ${
            data.viewOpts &&
            Object.keys(data.viewOpts).map((accountName) => {
              return html`<optgroup label=${accountName}>
                ${data.viewOpts[accountName].map(({ id, name }) => {
                  return html`
                    <option ?selected=${state.viewId === id} .value=${id}>
                      ${name}
                    </option>
                  `;
                })}
              </optgroup>`;
            })
          }
        </select>
      </div>
      <div class="Form-field">
        <label>2. Choose a date range</label>
        <select id="dateRange">
          ${renderOpts(state.dateRange, data.dateRangeOpts)}
        </select>
        ${
          showCustomDateRangeSelect
            ? html` <div class="Form-subfield">
                <div class="Form-field">
                  <label>Start date</label>
                  <input id="startDate" type="date" .value=${state.startDate} />
                </div>
                <div class="Form-field">
                  <label>End date</label>
                  <input id="endDate" type="date" .value=${state.endDate} />
                </div>
              </div>`
            : null
        }
      </div>
      <div class="Form-field">
        <label>3. Compare segments</label>
        <select id="segmentsRecommended">
          ${renderOpts(state.segmentsRecommended, data.segmentsRecommendedOpts)}
        </select>
        ${
          showCustomSegmentsSelect
            ? html`
                <div class="Form-subfield">
                  <div class="Form-field">
                    <label>First segment</label>
                    <select id="segmentA">
                      ${data.segmentOpts
                        ? html`
                            <optgroup label="Built-in Segments">
                              ${renderOpts(
                                state.segmentA,
                                data.segmentOpts.BUILT_IN
                              )}
                            </optgroup>
                            <optgroup label="Custom Segments">
                              ${renderOpts(
                                state.segmentA,
                                data.segmentOpts.CUSTOM
                              )}
                            </optgroup>
                          `
                        : null}
                    </select>
                  </div>
                  <div class="Form-field">
                    <label>Second segment</label>
                    <select id="segmentB">
                      ${data.segmentOpts
                        ? html`
                            <optgroup label="Built-in Segments">
                              ${renderOpts(
                                state.segmentB,
                                data.segmentOpts.BUILT_IN
                              )}
                            </optgroup>
                            <optgroup label="Custom Segments">
                              ${renderOpts(
                                state.segmentB,
                                data.segmentOpts.CUSTOM
                              )}
                            </optgroup>
                          `
                        : null}
                    </select>
                  </div>
                </div>
              `
            : null
        }
      </div>

      <div class="Form-field">
        <label class="Form-advancedAction">
          <input type="checkbox" id="opts:active" .checked=${opts.active}>
          Use advanced options (configurable per account)
        </label>
        ${
          opts.active
            ? html` <div class="Form-advancedFields">
                <div class="Form-field">
                  <label>Metric ID dimension</label>
                  <input
                    id="opts:metricIdDim"
                    type="text"
                    .value=${opts.metricIdDim}
                  />
                </div>
                <div class="Form-field">
                  <label>Metric name dimension</label>
                  <input
                    id="opts:metricNameDim"
                    type="text"
                    .value=${opts.metricNameDim}
                  />
                </div>
                <div class="Form-3col">
                  <div class="Form-field">
                    <label>LCP name</label>
                    <input
                      id="opts:lcpName"
                      type="text"
                      .value=${opts.lcpName}
                    />
                  </div>
                  <div class="Form-field">
                    <label>FID name</label>
                    <input
                      id="opts:fidName"
                      type="text"
                      .value=${opts.fidName}
                    />
                  </div>
                  <div class="Form-field">
                    <label>CLS name</label>
                    <input
                      id="opts:clsName"
                      type="text"
                      .value=${opts.clsName}
                    />
                  </div>
                  <div class="Form-field">
                    <label>FCP name</label>
                    <input
                      id="opts:fcpName"
                      type="text"
                      .value=${opts.fcpName}
                    />
                  </div>
                  <div class="Form-field">
                    <label>TTFB name</label>
                    <input
                      id="opts:ttfbName"
                      type="text"
                      .value=${opts.ttfbName}
                    />
                  </div>
                </div>
                <div class="Form-field">
                  <label>Debug dimension <em>(optional)</em></label>
                  <input
                    id="opts:debugDim"
                    type="text"
                    .value=${opts.debugDim}
                  />
                </div>
                <div class="Form-field">
                  <label>Additional filters <em>(optional)</em></label>
                  <input id="opts:filters" type="text" .value=${opts.filters} />
                </div>
              </div>`
            : null
        }
      </div>

      <div class="Form-action">
        <button class="Button" .disabled=${state.isFetchingData}>
          ${state.isFetchingData ? `Loading... ${state.progress}` : "Submit"}
        </button>
      </di>
    </form>
  `;
};

function renderApp() {
  render(app(getState(), data), document.getElementById("app"));
}

let isRenderPending = false;
function queueRender() {
  if (!isRenderPending) {
    requestAnimationFrame(() => {
      renderApp();
      isRenderPending = false;
    });
    isRenderPending = true;
  }
}

async function handleSignInChange(isSignedIn) {
  const signInToggle = document.getElementById("signin-toggle");
  const toggle = isSignedIn ? "Out" : "In";
  const classes = ["isSignedIn", "isSignedOut"];
  if (isSignedIn) {
    await Promise.all([initViewOpts(), initSegmentOpts()]);
  } else {
    classes.reverse();
    document.getElementById("report").hidden = true;
  }

  signInToggle.textContent = `Sign ${toggle}`;
  document.body.classList.add(classes[0]);
  document.body.classList.remove(classes[1]);

  signInToggle.onclick = isSignedIn
    ? () => signOut(handleSignInChange)
    : () => signIn();

  document.getElementById("signin-button").style.display = isSignedIn
    ? "none"
    : "flex";
}

async function init() {
  initAnalytics();

  document.getElementById("signin-button").onclick = () =>
    signIn();

  const isSignedIn = await checkAuthStatus();
  handleSignInChange(isSignedIn);

  const state = initState((storedState) => {
    const defaultState = {
      dateRange: 7,
      segmentsRecommended: "-15,-14",
    };
    const loadState = {
      isFetchingData: false,
      isSignedIn,
    };
    return Object.assign(defaultState, storedState, loadState);
  });

  addChangeListener("dateRange", onDateRangeChange);
  addChangeListener("segmentsRecommended", onSegmentsRecommendedChange);
  addChangeListener("isFetchingData", onIsFetchingDataChange);
  addChangeListener("*", queueRender);

  // onSignInChange(handleSignInChange);
  onDateRangeChange(state.dateRange);
  onSegmentsRecommendedChange(state.segmentsRecommended);

  renderApp();

  await nextFrame();
  document.body.classList.add("isReady");
}

window.onGoogleLibraryLoad = () => {
  signInCallback(handleSignInChange);
};

// Initialize the page.
init();
//# sourceMappingURL=main.js.map
