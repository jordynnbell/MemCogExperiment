# Memory & Encoding Experiment

## Run it
1. Keep `index.html`, `styles.css`, and `script.js` in the same folder.
2. Open `index.html` in a modern browser. No server, dependencies, installation, or build step is required.

## Procedure
- Randomizes the order of the three encoding strategies and assigns a shuffled six-word list to each strategy.
- Presents each word for four seconds.
- Gives strategy-specific instructions before each block.
- Runs a 30-second backward-by-three distractor task from a random three-digit number.
- Collects free recall and scores each word against the studied set.
- Provides a one-row session summary CSV and an 18-row trial-level CSV.

## Scoring
Matching is case- and punctuation-insensitive. The scorer also accepts a conservative Levenshtein spelling tolerance (one edit for words shorter than eight characters, two for longer words). Responses are used at most once, preventing a single typed response from receiving credit for multiple study words.

## Data and limitations
This is a client-side demonstration. Data remain in the browser unless the participant downloads the CSV files. The typo-tolerant scoring is approximate: it may occasionally accept an unintended near-match or fail to recognize a meaningful synonym. For formal research, preregister the scoring rules, pilot the task, and obtain appropriate ethics/IRB review and informed consent.
