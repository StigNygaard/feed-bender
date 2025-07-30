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
    return doc.body.textContent || '';
}

/**
 * Setup "feed peeker"...
 */
function setupFeedPeeker(el) {
    function itemAuthor(item) {
        return item.authors?.at(0)?.name ?? item.author?.name;
    }
    function itemDate(item) {
        const date = new Date(item.date_published);
        if(date.toString() === 'Invalid Date') return '';
        return new Intl.DateTimeFormat("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
            hour12: false
        }).format(date);
    }
    el.addEventListener('mouseenter', // mouseover?
        function (ev) {
            let popup = ev.target.querySelector('.peek-popup');
            if (!popup) {
                popup = cr('div', {class: 'peek-popup'});
                el.append(popup);
                fetch(ev.target.dataset.json).then(
                    response => response.json()
                ).then(
                    json => {
                        popup.append(cr('h3', {}, cr('a', {href: json.home_page_url}, json.title)));
                        json.items.forEach(item => {
                            const author = itemAuthor(item);
                            const itemEl = cr('div', {class: 'peek-item'},
                                cr('img', {src: item.image ?? '', alt: ''}),
                                cr('h4', {}, cr('a', {href: item.url}, item.title)),
                                cr('div', {class: 'byline'}, cr('time', {datetime: item.date_published}, itemDate(item)), (author ? ` - by ${author}` : '')),
                                cr('p', {class: 'item-content'}, item.content_text ?? stripHtml(item.content_html)));
                            popup.append(itemEl);
                        })
                    }
                ).catch(
                    error => {
                        // TODO write error-msg in popup (unable to load feed)
                        console.error(error);
                    }
                ).finally(
                    () => {
                        // TODO remove a shown "load-spinner"
                    }
                )
            }
        });
}

/**
 * "on-load" handler
 */
window.addEventListener('DOMContentLoaded',
    function () {
        /**
         * setup "feed-peekers"...
         */
        document.querySelectorAll('.peek').forEach(setupFeedPeeker);
    },
    false
);
