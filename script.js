// ==UserScript==
// @name         Automated Bing Random Word Searcher
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Fetches random words and types them into the Bing search bar with human-like delays, correctly handling page navigation.
// @author       You
// @match        *://www.bing.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @connect      random-word-api.vercel.app
// @run-at       document-idle
// ==/UserScript==

(async function() {
    'use strict';

    // --- Configuration ---
    const SEARCH_BAR_SELECTOR = "#sb_form_q"; // The Bing search bar's CSS selector
    const API_URL = "https://random-word-api.vercel.app/api?words=10";

    const KEY_STROKE_MIN_DELAY_MS = 500;  // Minimum delay between characters (milliseconds)
    const KEY_STROKE_MAX_DELAY_MS = 800; // Maximum delay between characters (milliseconds)

    const SEARCH_WAIT_MIN_S = 10;        // Minimum wait time between searches (seconds)
    const SEARCH_WAIT_MAX_S = 15;        // Maximum wait time between searches (seconds)

    // --- Storage Keys ---
    const STORAGE_KEY_WORDS = 'AutoSearch_Words';
    const STORAGE_KEY_INDEX = 'AutoSearch_Index';

    /** Helper Functions (unchanged from original) **/
    function getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Fetches a list of random words from the API using GM_xmlhttpRequest.
     * @returns {Promise<string[]>} An array of words.
     */
    async function getWords() {
        console.log("Fetching new batch of words...");
        try {
            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: API_URL,
                    onload: (res) => {
                        if (res.status >= 200 && res.status < 300) {
                            resolve(JSON.parse(res.responseText));
                        } else {
                            reject(new Error(`API request failed with status: ${res.status}`));
                        }
                    },
                    onerror: (err) => reject(new Error("Network error during API fetch")),
                    ontimeout: () => reject(new Error("API request timed out"))
                });
            });
            return response;
        } catch (error) {
            console.error("Error fetching words:", error);
            // Fallback: Return empty array to stop the script
            return [];
        }
    }

    /**
     * Simulates human-like typing. (unchanged from original)
     */
    async function typeText(element, text) {
        element.focus();
        element.value = '';

        for (const char of text) {
            element.value += char;
            // Dispatch a new InputEvent to notify the page JS of the change
            element.dispatchEvent(new Event('input', { bubbles: true }));

            const randomDelay = getRandomInt(KEY_STROKE_MIN_DELAY_MS, KEY_STROKE_MAX_DELAY_MS);
            await delay(randomDelay);
        }
    }

    /**
     * Submits the search. (unchanged from original)
     */
    function submitSearch(element) {
        const form = element.closest('form');
        if (form) {
            form.submit();
        } else {
            console.error("Could not find a form to submit. Search may not start.");
        }
    }

    // =========================================================================
    //                            MAIN LOGIC
    // =========================================================================

    /**
     * Handles the logic on the search results page: waiting and navigation.
     */
    async function handlePostSearch() {
        // Only run on a page that is NOT the Bing homepage (i.e., on the search results)
        if (window.location.pathname === '/' || window.location.search === '') {
            return;
        }

        console.log("On search results page. Starting post-search delay...");
        const waitTimeSeconds = getRandomInt(SEARCH_WAIT_MIN_S, SEARCH_WAIT_MAX_S);
        console.log(`Waiting for ${waitTimeSeconds} seconds before navigating back for the next search...`);

        // The critical fix: The long delay happens HERE, on the search results page.
        await delay(waitTimeSeconds * 1000);

        // After the delay, navigate back to the Bing homepage to start the next search.
        window.location.href = window.location.origin;
    }

    /**
     * Handles the logic on the Bing homepage: fetching state, typing, and submitting.
     */
    async function handlePreSearch() {
        // Only run on the Bing homepage
        if (window.location.pathname !== '/' && window.location.search !== '') {
            return;
        }

        const searchBar = document.querySelector(SEARCH_BAR_SELECTOR);
        if (!searchBar) {
            console.error("Search bar element not found. Exiting.");
            return;
        }
        
        // 1. Get current state
        let words = GM_getValue(STORAGE_KEY_WORDS);
        let index = GM_getValue(STORAGE_KEY_INDEX, 0);

        // 2. Check if we need to fetch new words (first run or list exhausted)
        if (!words || index >= words.length) {
            words = await getWords();
            if (words.length === 0) {
                console.log("Could not fetch new words. Script stopping.");
                GM_deleteValue(STORAGE_KEY_WORDS); // Clean up if fetch failed
                GM_deleteValue(STORAGE_KEY_INDEX);
                return;
            }
            // Save new state
            GM_setValue(STORAGE_KEY_WORDS, words);
            GM_setValue(STORAGE_KEY_INDEX, 0);
            index = 0;
        }

        const currentWord = words[index];
        console.log(`Starting search ${index + 1}/${words.length} for: "${currentWord}"`);
        
        // 3. Increment index for the NEXT run
        GM_setValue(STORAGE_KEY_INDEX, index + 1);

        // 4. Type the word slowly
        await typeText(searchBar, currentWord);

        // 5. Perform the search
        submitSearch(searchBar);
        // The script is terminated here and restarts on the search results page.
    }

    // =========================================================================
    // EXECUTION START
    // =========================================================================
    if (window.location.pathname === '/' && window.location.search === '') {
        // On Bing homepage: Start or continue the search sequence
        await handlePreSearch();
    } else {
        // On Bing search results page: Handle the waiting/navigation back
        await handlePostSearch();
    }

})();