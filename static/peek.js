window.addEventListener('DOMContentLoaded',
    function () {
        console.log('DOMContentLoaded');
        document.querySelectorAll('.peek').forEach(
            function (el) {
                console.log(`Setting up eventhandlers on peek-element for feed ${el.dataset.json}`);
                el.addEventListener('mouseenter', function () { // mouseover?
                    // 1) If not already created, create an element populated with items from feed (data-json attribute)
                    // 2) Display element as a popup
                });
                el.addEventListener('mouseleave', function () { // mouseout?
                    // 1) Hide element/popup
                });

                // Eventually be inspired by tooltip implementation (commenter emails) on rockland.dk
            }
        )
    }, false

    // Alternatively, show popup on :hover (css) if we can trigger populating of the popup from feed when popup-element becomes visible?

);
