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
 * @param {string | Document} html - The HTML string (or HTMLDocument) from which to strip html-tags.
 * @return {string} The plain text content extracted from the input.
 */
function stripHtml(html) {
    return (html instanceof Document ? html : new DOMParser().parseFromString(html, 'text/html')).body.textContent ?? '';
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
        if (date.toString() === 'Invalid Date') return '';
        return new Intl.DateTimeFormat(/* undefined */ 'en-CA', { // Just happen to like this en-CA based datetime format :-)
            dateStyle: 'short',
            timeStyle: 'short',
            hour12: false // timeZoneName: 'shortOffset' (or 'short'?)
        }).format(date);
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat
    }

    el.addEventListener('mouseenter', // mouseover?
        function (ev) {
            let popup = ev.target.querySelector('.peek-popup');
            if (!popup) {
                popup = cr('aside', {class: 'peek-popup'});
                el.append(popup);
                fetch(ev.target.dataset.json).then(
                    response => {
                        if (!response.ok) {
                            throw new Error(`fetch '${ev.target.dataset.json}' response status: \n${response.status}: ${response.statusText}`);
                        }
                        return response.json();
                    }
                ).then(
                    json => {
                        // console.log(JSON.stringify(json));
                        popup.append(cr('h3', {}, cr('a', {href: json.home_page_url}, json.title)));
                        if (!json.items?.length) {
                            popup.append(cr('p', {class: 'error'}, 'Did not retrieve any feed content - Try reloading page or come back later.'));
                            return;
                        }
                        json.items.forEach(item => {
                            const htmlDoc = new DOMParser().parseFromString(item.content_html ?? '', 'text/html');
                            if (!item.image) {
                                const img = htmlDoc.querySelector('img[src^="https://"],img[src^="//"]')?.src ?? '';
                                if (img) {
                                    item.image = img;
                                }
                            }
                            const author = itemAuthor(item);
                            const itemEl = cr('div', {class: 'peek-item'},
                                cr('img', {src: item.image ?? '', alt: '', loading: 'lazy'}),
                                cr('h4', {}, cr('a', {href: item.url}, item.title)),
                                cr('div', {class: 'byline'},
                                    cr('time',
                                        {
                                            datetime: item.date_published,
                                            title: item.date_published
                                        },
                                        itemDate(item)), (author ? ` - by ${author}` : '')
                                        // , item.id ? ` (${item.id})` : ''
                                ),
                                cr('p', {class: 'item-content'}, item.content_text ?? stripHtml(htmlDoc)),
                            );
                            if (item.tags?.length) {
                                itemEl.append(cr('div', {class: 'item-categories'}, item.tags.join(', ')));
                            }
                            popup.append(itemEl);
                        })
                    }
                ).catch(
                    error => {
                        popup.append(cr('p', {class: 'error'}, 'There was a problem loading the feed - Try reloading page or come back later.'));
                        console.error(error);
                    }
                ).finally(
                    () => {
                        popup.classList.add('fetched'); // remove "load-spinner"
                    }
                )
            } else {
                popup.scrollTop = 0;
            }
        });
}

/**
 * "on-load" handler
 */
window.addEventListener('DOMContentLoaded',
    function () {
        /**
         * setup the "feed-peekers"...
         */
        document.querySelectorAll('.peek').forEach(setupFeedPeeker);
    },
    false
);
