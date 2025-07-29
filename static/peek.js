/**
 * Create a DOM element with optional attributes and content (children/subtree)
 * @param tagName {string} - The tagname for HTMLElement to create
 * @param [attributes] {Object} - An object where properties defines attributes of the HTMLElement
 * @param [content] - A number of children. Can be a mix of Nodes/Elements and strings.
 * @returns {HTMLElement}
 */
function cr(tagName, attributes = {}, ...content) {
    const element = document.createElement(tagName);
    for (const [attr, value] of Object.entries(attributes)) {
        if (value === false) {
            // Ignore - Don't create attribute (the attribute is "disabled")
        } else if (value === true) {
            element.setAttribute(attr, attr); // xhtml compatible "enabled" attribute
        } else {
            element.setAttribute(attr, value);
        }
    }
    if (content?.length) {
        element.append(...content);
    }
    return element;
}

/**
 * Removes all HTML tags from the given HTML string and returns the plain text content.
 * @param {string} html - The HTML string from which to strip tags.
 * @return {string} The plain text content extracted from the input HTML string.
 */
function stripHtml(html){
    let doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
}

/**
 * "feed peeker"...
 */
window.addEventListener('DOMContentLoaded',
    function () {
        console.log('DOMContentLoaded');
        document.querySelectorAll('.peek').forEach(
            function (el) {
                console.log(`Setting up eventhandlers on peek-element for feed ${el.dataset.json}`);
                el.addEventListener('mouseenter', function (ev) { // mouseover?
                    let popup = ev.target.querySelector('.peek-popup');
                    if (!popup) {
                        popup = cr('div', {class: 'peek-popup'});
                        el.append(popup);
                        fetch(ev.target.dataset.json).then(
                            response => response.json()
                        ).then(
                            json => {
                                console.info(json);
                                popup.append(cr('h3', {}, cr('a', {href: json.home_page_url}, json.title)));
                                json.items.forEach(item => {
                                    const itemEl = cr('div', {class: 'peek-item'},
                                        cr('img', {src: item.image, alt: ''}),
                                        cr('h4', {}, cr('a', {href: item.url}, item.title)),
                                        cr('time', {datetime: item.date_published}, item.date_published),
                                        cr('p', {class: 'item-content'}, stripHtml(item.content_html)));
                                    popup.append(itemEl);
                                })
                            }
                        ).catch(
                            error => {
                                console.error(error);
                            }
                        )
                    }
                });
                el.addEventListener('mouseleave', function (ev) { // mouseout?
                });
            }
        )
    }, false

);
