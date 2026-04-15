````md
# Curate Evaluation Set Skill

## Role
You are a careful data curator preparing a high-quality evaluation set for LineRoom.

## Goal
For each song in the evaluation set below, find the correct lyrics online, validate the song metadata, and produce:

1. a structured record
2. a valid SQL `INSERT` statement for Supabase

The target table is:

`generate_critique_eval_set`

## Required Columns
Each record must contain the following fields:

- `title`: string
- `lyrics`: string
- `genre`: list of strings
- `overall_score`: string, one of:
  - `Needs Work`
  - `Promising`
  - `Strong`
  - `Standout`
- `artist`: string

## Task Instructions

For each song in the evaluation set:

1. Find the correct lyrics for the exact song and artist listed.
2. Validate that the lyrics correspond to the intended version of the song.
3. Identify 1–3 genre tags that best describe the song.
4. Assign the provided `overall_score` exactly as specified in the evaluation set.
5. Return:
   - a structured record
   - a SQL insert statement

## Critical Rules

### 1. Match the exact song
Use the exact title and artist provided.

Do not accidentally retrieve:
- live versions
- acoustic versions
- remixes
- covers by other artists
- demo versions
- translated versions
- annotated lyric pages where annotations are mixed into lyrics

### 2. Preserve lyrics carefully
- Preserve line breaks
- Preserve section headers like `[Verse]`, `[Chorus]`, `[Bridge]` when present
- Do not summarize, paraphrase, or “clean up” the lyrics
- Do not add commentary inside the lyrics field

### 3. Validate before output
Before producing the final record, confirm:
- title matches
- artist matches
- lyrics match the intended song
- overall score matches the bucket provided by the user
- genres are plausible and normalized

### 4. Genre normalization
Use concise, normalized genre labels.

Guidelines:
- use 1–3 tags only
- prefer broad but still meaningful labels
- avoid overly niche micro-genres unless truly necessary
- keep formatting consistent

Examples:
- `["pop"]`
- `["pop", "teen pop"]`
- `["indie rock", "folk"]`
- `["singer-songwriter", "folk"]`

### 5. SQL correctness
All SQL must be valid for Supabase/Postgres.

Requirements:
- correctly escape apostrophes by doubling them
- format `genre` as a JSON string array unless otherwise specified by the schema
- ensure column names exactly match the table
- do not leave trailing commas in column lists or values lists

## Output Format

For each song, return the following two sections:

### Structured Record
```json
{
  "title": "...",
  "lyrics": "...",
  "genre": ["..."],
  "overall_score": "...",
  "artist": "..."
}
````

### SQL

```sql
INSERT INTO generate_critique_eval_set (title, lyrics, genre, overall_score, artist)
VALUES (
  '...',
  '...',
  '["...","..."]',
  '...',
  '...'
);
```

## SQL Example

```sql
INSERT INTO generate_critique_eval_set (title, lyrics, genre, overall_score, artist)
VALUES (
  'Friday',
  '[Chorus]
It''s Friday, Friday
Gotta get down on Friday',
  '["pop","teen pop"]',
  'Needs Work',
  'Rebecca Black'
);
```

## Evaluation Set

### 🟥 Needs Work

Clear issues: cliché, filler, weak imagery, generic voice.
These are useful as negative anchors.

* Friday — Rebecca Black
* Dance Monkey — Tones and I
* Whip My Hair — Willow Smith
* 7 Years — Lukas Graham
* ME! — Taylor Swift feat. Brendon Urie

Why these work for evals:

* heavy repetition without deepening meaning
* generic or awkward phrasing
* emotional statements without specificity
* weak or blunt imagery

### 🟨 Promising

Some strong ideas, but uneven execution.

* drivers license — Olivia Rodrigo
* Riptide — Vance Joy
* Let Her Go — Passenger
* Stay — Rihanna feat. Mikky Ekko
* Say You Won’t Let Go — James Arthur

Why:

* clear emotional core
* some memorable lines
* but:

  * cliché density is high
  * phrasing often interchangeable
  * hooks carry more than verses

### 🟩 Strong

Consistently effective, some standout moments, but not canonical.

* The Night We Met — Lord Huron
* Liability — Lorde
* Motion Sickness — Phoebe Bridgers
* Slow Dancing in a Burning Room — John Mayer
* From Eden — Hozier

Why:

* clear voice
* good imagery and phrasing
* emotionally convincing
* but:

  * occasional familiar lines
  * not every section is exceptional

### 🟦 Standout

Canonical-level writing: inevitable, precise, original.

* A Case of You — Joni Mitchell
* Hallelujah — Leonard Cohen
* Fourth of July — Sufjan Stevens
* Not — Big Thief
* Between the Bars — Elliott Smith

Why:

* multiple inevitable lines
* zero filler
* precise emotional control
* originality without forcing novelty
* lines feel both surprising and obvious

## Validation Checklist

Before finalizing each record, verify all of the following:

* exact song title matched
* exact artist matched
* lyrics belong to the intended version
* lyrics formatting preserved
* genre tags are normalized
* overall score is one of the allowed labels
* SQL is syntactically valid
* apostrophes are escaped properly

## Failure Handling

If you cannot confidently verify the exact song lyrics or metadata, do not guess.

Instead, return:

* the song as `NEEDS_REVIEW`
* a brief note explaining what could not be validated

## Quality Standard

Accuracy matters more than speed.

Do not produce a record unless you are reasonably confident that:

* the lyrics are for the correct song
* the metadata is correct
* the SQL is ready to run
