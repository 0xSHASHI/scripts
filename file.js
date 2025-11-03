// ==UserScript==
// @name         Auto Searcher
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Human-like Bing search with realistic typing, scrolling, and clicks with safe return handling
// @author       You
// @match        https://www.bing.com/*
// @match        https://*/*
// @grant        GM_xmlhttpRequest
// @connect      random-word-api.vercel.app
// ==/UserScript==

(function () {
    "use strict";

    // --- CONFIG ---
    const WORDS_URL = "https://random-word-api.vercel.app/api?words=50";
    const TYPE_DELAY = [280, 750];
    const THINK_PAUSE = [1000, 3000];
    const SUBMIT_DELAY = [2000, 6000];
    const NEXT_SEARCH_DELAY = [25000, 90000];
    const BREAK_CHANCE = 0.1;
    const LONG_BREAK = [5 * 60 * 1000, 15 * 60 * 1000];
    const CLICK_CHANCE = 0.7; // increased
    const DWELL_TIME = [12000, 30000];

    const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
    const randChoice = arr => arr[randInt(0, arr.length - 1)];
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    let busy = false;

    // --- Typing ---
    async function typeLikeHuman(input, text) {
        input.value = "";
        for (let char of text) {
            input.value += char;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            await sleep(randInt(...TYPE_DELAY));
            if (Math.random() < 0.2) await sleep(randInt(...THINK_PAUSE));
        }
    }

    // --- Scrolling ---
    async function naturalScroll() {
        const maxY = document.body.scrollHeight - window.innerHeight;
        let y = 0;

        for (let i = 0; i < randInt(5, 15); i++) {
            y = Math.min(maxY, y + randInt(150, 800));
            window.scrollTo(0, y);
            await sleep(randInt(1500, 5000));

            if (Math.random() < 0.3) {
                y = Math.max(0, y - randInt(200, 600));
                window.scrollTo(0, y);
                await sleep(randInt(1500, 4000));
            }
        }

        // sometimes go bottom & wait
        if (Math.random() < 0.3) {
            window.scrollTo(0, maxY);
            await sleep(randInt(4000, 8000));
        }

        // always return to top before next action
        window.scrollTo({ top: 0, behavior: "smooth" });
        await sleep(randInt(3000, 6000));
    }

    // --- Random click ---
    async function maybeClickResult() {
        if (Math.random() < CLICK_CHANCE) {
            let links = document.querySelectorAll("#b_results li.b_algo h2 a");
            if (links.length) {
                let link = randChoice([...links]);
                console.log("Clicking:", link.href);

                // force same tab
                link.removeAttribute("target");
                link.click();
            }
        }
    }

    // --- Main search ---
    function startSearch() {
        if (busy) return;
        busy = true;

        GM_xmlhttpRequest({
            method: "GET",
            url: WORDS_URL,
            onload: async res => {
                try {
                    let words = JSON.parse(res.responseText);
                    let query = Array.from({ length: randInt(1, 3) }, () => randChoice(words)).join(" ");

                    let input = document.querySelector("#sb_form_q");
                    let form = document.querySelector("#sb_form");

                    if (input && form) {
                        await typeLikeHuman(input, query);
                        await sleep(randInt(...SUBMIT_DELAY));
                        form.submit();

                        setTimeout(async () => {
                            await naturalScroll();
                            await maybeClickResult();

                            let delay = randInt(...NEXT_SEARCH_DELAY);
                            if (Math.random() < BREAK_CHANCE) delay = randInt(...LONG_BREAK);

                            setTimeout(() => {
                                busy = false;
                                startSearch();
                            }, delay);
                        }, randInt(5000, 9000));
                    } else {
                        busy = false;
                    }
                } catch (e) {
                    console.error("Search error:", e);
                    busy = false;
                }
            }
        });
    }

    // --- Handle clicked pages (return to Bing) ---
    if (location.hostname !== "www.bing.com") {
        setTimeout(() => {
            if (history.length > 1) {
                history.back();
            } else {
                window.location.href = "https://www.bing.com";
            }
        }, randInt(...DWELL_TIME));
    } else {
        setTimeout(startSearch, randInt(5000, 12000));
    }
})();