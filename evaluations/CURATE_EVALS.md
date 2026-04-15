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

- `id`: int
- `title`: string
- `lyrics`: string
- `genre`: list of strings
- `overall_score`: string, one of:
  - `Needs Work`
  - `Promising`
  - `Strong`
  - `Standout`
- `artist`: string
- `rationale_short`: why this is in the eval set

## Task Instructions

For each song in the evaluation set:

1. Find the correct lyrics for the exact song and artist listed.
2. Validate that the lyrics correspond to the intended version of the song.
3. Identify 1–3 genre tags that best describe the song.
4. Assign the provided `overall_score` exactly as specified in the evaluation set.
5. Return and save:
   - a structured record
   - a SQL insert statement
6. Append the SQL insert statement to a growing evaluation_set_inserts.sql file that will contain inserts for each song.

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
  "artist": "...",
  "rationale_short":"..."
}
````

### SQL

```sql
INSERT INTO generate_critique_eval_set (id, title, lyrics, genre, overall_score, artist,rationale_short)
VALUES (
  int,
  '...',
  '...',
  '["...","..."]',
  '...',
  '...',
  '...'
);
```

## SQL Example

```sql
INSERT INTO generate_critique_eval_set (id, title, lyrics, genre, overall_score, artist)
VALUES (
  1,
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

* **Needs Work** = clear lyrical weakness, cliché, filler, awkward phrasing, thin imagery, or excessive repetition
* **Promising** = real strengths, but uneven execution or partial genericness
* **Strong** = well-written, memorable, specific, cohesive
* **Standout** = exceptional lyric writing / voice / imagery / emotional intelligence / craft

I balanced this set across **pop, rock/indie, singer-songwriter/folk, hip-hop/R&B, country, and a few dance/alternative cases** so the model does not just learn “folk = good, novelty pop = bad.” For the upper bands, I leaned on broad critical canon sources to avoid overfitting to one scene, and for weaker examples I also kept in mind external analyses of repetition/common lyrical flattening so the set includes multiple *kinds* of weakness rather than only joke songs. ([rollingstone.com][1])

## LineRoom Evaluation Set (60 Songs)

Balanced across:

* **Overall score bands:** Needs Work / Promising / Strong / Standout
* **Genre spread:** pop, pop-rock, indie, singer-songwriter, hip-hop, R&B, country, dance-pop, art pop

Included fields:

* **Title**
* **Artist**
* **Genre tags**
* **Overall rating band**
* **Primary strength or failure mode**
* **Confidence**
* **Notes**

---

### 1–15. Needs Work

1. **Friday** — Rebecca Black

   * Genre tags: teen pop, novelty pop
   * Overall rating band: **Needs Work**
   * Primary failure mode: awkward phrasing / shallow writing
   * Confidence: **High**
   * Notes: useful negative anchor for thin specificity, clunky lines, and novelty-driven construction.

2. **Wiggle** — Jason Derulo ft. Snoop Dogg

   * Genre tags: pop-rap, club pop
   * Overall rating band: **Needs Work**
   * Primary failure mode: gimmick-driven repetition
   * Confidence: **High**
   * Notes: catchy but lyrically very thin; good example of hook-first writing without much substance.

3. **My Humps** — The Black Eyed Peas

   * Genre tags: pop-rap, dance pop
   * Overall rating band: **Needs Work**
   * Primary failure mode: repetitive / low semantic richness
   * Confidence: **High**
   * Notes: strong test case for distinguishing memorability from lyric quality.

4. **Girls Like You** — Maroon 5

   * Genre tags: pop-rock, mainstream pop
   * Overall rating band: **Needs Work**
   * Primary failure mode: generic sentiment
   * Confidence: **Medium-High**
   * Notes: polished but bland; useful for detecting empty flattering language.

5. **Dear Future Husband** — Meghan Trainor

   * Genre tags: retro pop, novelty pop
   * Overall rating band: **Needs Work**
   * Primary failure mode: reductive concept / simplistic writing
   * Confidence: **High**
   * Notes: good example of a strong premise executed with low nuance.

6. **Fancy Like** — Walker Hayes

   * Genre tags: country-pop, novelty country
   * Overall rating band: **Needs Work**
   * Primary failure mode: brand-name gimmick writing
   * Confidence: **High**
   * Notes: useful for distinguishing cultural catchiness from lyrical depth.

7. **Cruise** — Florida Georgia Line

   * Genre tags: bro-country, country-pop
   * Overall rating band: **Needs Work**
   * Primary failure mode: cliché / vibe-over-writing
   * Confidence: **High**
   * Notes: strong negative anchor for surface-level country-pop imagery.

8. **Body Like a Back Road** — Sam Hunt

   * Genre tags: country-pop
   * Overall rating band: **Needs Work**
   * Primary failure mode: shallow imagery
   * Confidence: **High**
   * Notes: sticky and commercially effective, but lyric craft is limited.

9. **Hey, Soul Sister** — Train

   * Genre tags: pop-rock
   * Overall rating band: **Needs Work**
   * Primary failure mode: mixed / awkward imagery
   * Confidence: **High**
   * Notes: very useful for catching strained metaphor and “quirky” lines that do not really cohere.

10. **Hall of Fame** — The Script ft. will.i.am

* Genre tags: inspirational pop-rock
* Overall rating band: **Needs Work**
* Primary failure mode: slogan-writing / over-explanation
* Confidence: **High**
* Notes: a good example of uplift language that lacks originality.

11. **Demons** — Imagine Dragons

* Genre tags: arena rock, alt-pop
* Overall rating band: **Needs Work**
* Primary failure mode: vague emotional generality
* Confidence: **Medium-High**
* Notes: “serious-sounding” but broad; useful counterweight to overvaluing earnestness.

12. **Thunder** — Imagine Dragons

* Genre tags: arena pop-rock
* Overall rating band: **Needs Work**
* Primary failure mode: repetitive / underwritten
* Confidence: **High**
* Notes: strong negative example from a serious mainstream act, not just novelty pop.

13. **We Are Young** — fun. ft. Janelle Monáe

* Genre tags: indie-pop, anthem pop
* Overall rating band: **Needs Work**
* Primary failure mode: inflated anthem language
* Confidence: **Medium**
* Notes: memorable and emotionally legible, but useful for testing overpraise of anthemic tone.

14. **Riptide** — Vance Joy

* Genre tags: indie pop, folk-pop
* Overall rating band: **Needs Work**
* Primary failure mode: quirky but incoherent imagery
* Confidence: **Medium**
* Notes: important because it sounds “indie interesting” while being uneven on the page.

15. **Beautiful Things** — Benson Boone

* Genre tags: pop-rock, power ballad
* Overall rating band: **Needs Work**
* Primary failure mode: broad emotional language
* Confidence: **Medium**
* Notes: good modern example of intensity outpacing specificity.

---

### 16–30. Promising

16. **Drivers License** — Olivia Rodrigo

* Genre tags: pop ballad
* Overall rating band: **Promising**
* Primary strength/failure mode: emotional clarity with some generic phrasing
* Confidence: **Medium-High**
* Notes: strong emotional access, but not consistently exceptional line by line.

17. **Someone You Loved** — Lewis Capaldi

* Genre tags: adult pop, ballad
* Overall rating band: **Promising**
* Primary strength/failure mode: heartfelt but broad
* Confidence: **High**
* Notes: useful for testing the difference between sincerity and lyric distinction.

18. **Apologize** — OneRepublic

* Genre tags: pop-rock
* Overall rating band: **Promising**
* Primary strength/failure mode: clean concept, familiar language
* Confidence: **High**
* Notes: well-made and effective, but not especially original.

19. **Just the Way You Are** — Bruno Mars

* Genre tags: mainstream pop
* Overall rating band: **Promising**
* Primary strength/failure mode: high-function simplicity / generic compliment writing
* Confidence: **High**
* Notes: important anchor for “simple but competent.”

20. **Grenade** — Bruno Mars

* Genre tags: pop ballad
* Overall rating band: **Promising**
* Primary strength/failure mode: commitment to premise, somewhat overstated
* Confidence: **Medium-High**
* Notes: useful for testing melodramatic overextension.

21. **Ho Hey** — The Lumineers

* Genre tags: indie folk, stomp-folk
* Overall rating band: **Promising**
* Primary strength/failure mode: strong vibe, limited lyrical range
* Confidence: **High**
* Notes: a good example of communal effectiveness without deep writing.

22. **Sweater Weather** — The Neighbourhood

* Genre tags: indie pop, alt-rock
* Overall rating band: **Promising**
* Primary strength/failure mode: atmospheric voice, middling density
* Confidence: **Medium**
* Notes: good for evaluating aesthetic coolness vs actual line strength.

23. **Pompeii** — Bastille

* Genre tags: alt-pop, indie rock
* Overall rating band: **Promising**
* Primary strength/failure mode: evocative abstraction, some vagueness
* Confidence: **Medium-High**
* Notes: a useful abstraction test case.

24. **Stick Season** — Noah Kahan

* Genre tags: folk-pop
* Overall rating band: **Promising**
* Primary strength/failure mode: specific mood with some familiar phrasing
* Confidence: **Medium**
* Notes: strong contemporary singer-songwriter anchor without putting everything earnest into top tiers.

25. **Before He Cheats** — Carrie Underwood

* Genre tags: country
* Overall rating band: **Promising**
* Primary strength/failure mode: vivid and functional, not especially nuanced
* Confidence: **High**
* Notes: good example of sharp scenario writing that remains somewhat blunt.

26. **Tennessee Orange** — Megan Moroney

* Genre tags: country-pop
* Overall rating band: **Promising**
* Primary strength/failure mode: charming premise, moderate depth
* Confidence: **Medium**
* Notes: useful for modern country-pop calibration.

27. **God’s Plan** — Drake

* Genre tags: mainstream rap
* Overall rating band: **Promising**
* Primary strength/failure mode: charisma over intricate writing
* Confidence: **High**
* Notes: very useful to prevent the model from equating status/presence with lyrical excellence.

28. **XO TOUR Llif3** — Lil Uzi Vert

* Genre tags: emo rap, trap
* Overall rating band: **Promising**
* Primary strength/failure mode: emotional atmosphere / fragmented writing
* Confidence: **Medium**
* Notes: tests mood-heavy songwriting with partial lyric coherence.

29. **Redbone** — Childish Gambino

* Genre tags: psychedelic soul, R&B
* Overall rating band: **Promising**
* Primary strength/failure mode: groove and tone over lyric density
* Confidence: **Medium**
* Notes: a good reminder that a great song overall is not always a lyric-top-tier song.

30. **Too Sweet** — Hozier

* Genre tags: pop-soul, blues-pop
* Overall rating band: **Promising**
* Primary strength/failure mode: stylish voice, limited development
* Confidence: **Medium**
* Notes: good case for songs with strong persona and phrasing but moderate depth.

---

### 31–45. Strong

31. **Fast Car** — Tracy Chapman

* Genre tags: folk-rock
* Overall rating band: **Strong**
* Primary strength/failure mode: narrative specificity
* Confidence: **High**
* Notes: excellent model for scene, aspiration, and compression.

32. **Landslide** — Fleetwood Mac

* Genre tags: singer-songwriter, folk-rock
* Overall rating band: **Strong**
* Primary strength/failure mode: reflective clarity
* Confidence: **High**
* Notes: simple, resonant, and durable without overstatement.

33. **A Case of You** — Joni Mitchell

* Genre tags: singer-songwriter
* Overall rating band: **Strong**
* Primary strength/failure mode: memorable phrasing / intimate specificity
* Confidence: **High**
* Notes: a high bar for voice and emotional exactness.

34. **Jolene** — Dolly Parton

* Genre tags: country
* Overall rating band: **Strong**
* Primary strength/failure mode: directness with dramatic tension
* Confidence: **High**
* Notes: ideal example of simple language used with precision.

35. **Blue Ain’t Your Color** — Keith Urban

* Genre tags: country
* Overall rating band: **Strong**
* Primary strength/failure mode: focused scene writing
* Confidence: **Medium-High**
* Notes: useful modern country example of elegant emotional framing.

36. **All Too Well (5 Minute Version)** — Taylor Swift

* Genre tags: pop, folk-pop
* Overall rating band: **Strong**
* Primary strength/failure mode: narrative detail and emotional escalation
* Confidence: **High**
* Notes: a strong modern benchmark for memory-based writing.

37. **Blank Space** — Taylor Swift

* Genre tags: pop
* Overall rating band: **Strong**
* Primary strength/failure mode: concept execution / voice
* Confidence: **High**
* Notes: important top-band pop anchor; clever, controlled, and sharply characterized.

38. **Supercut** — Lorde

* Genre tags: art-pop, electropop
* Overall rating band: **Strong**
* Primary strength/failure mode: modern emotional framing
* Confidence: **High**
* Notes: strong example of contemporary pop writing with perspective.

39. **Motion Sickness** — Phoebe Bridgers

* Genre tags: indie rock
* Overall rating band: **Strong**
* Primary strength/failure mode: tonal complexity / voice
* Confidence: **High**
* Notes: good model for sharp modern indie lyricism.

40. **Self Control** — Frank Ocean

* Genre tags: alt R&B
* Overall rating band: **Strong**
* Primary strength/failure mode: emotional layering / restraint
* Confidence: **High**
* Notes: excellent for subtle modern R&B writing.

41. **Good Kid** — Kendrick Lamar

* Genre tags: hip-hop
* Overall rating band: **Strong**
* Primary strength/failure mode: scene construction / social tension
* Confidence: **High**
* Notes: strong rap anchor with vivid narrative pressure.

42. **Song Cry** — Jay-Z

* Genre tags: hip-hop
* Overall rating band: **Strong**
* Primary strength/failure mode: mature self-implication
* Confidence: **High**
* Notes: very useful example of emotionally controlled rap writing.

43. **I Can’t Make You Love Me** — Bonnie Raitt

* Genre tags: adult contemporary, ballad
* Overall rating band: **Strong**
* Primary strength/failure mode: restraint / emotional precision
* Confidence: **High**
* Notes: one of the clearest examples of simple language done beautifully.

44. **The Night We Met** — Lord Huron

* Genre tags: indie folk
* Overall rating band: **Strong**
* Primary strength/failure mode: haunting simplicity
* Confidence: **Medium-High**
* Notes: useful for distinguishing sparse effectiveness from emptiness.

45. **Liability** — Lorde

* Genre tags: art-pop, piano ballad
* Overall rating band: **Strong**
* Primary strength/failure mode: vulnerable directness
* Confidence: **High**
* Notes: a strong modern example of plainspoken but distinctive writing.

---

### 46–60. Standout

46. **Both Sides, Now** — Joni Mitchell

* Genre tags: singer-songwriter
* Overall rating band: **Standout**
* Primary strength/failure mode: conceptual coherence / perspective
* Confidence: **High**
* Notes: elite example of reflective structure and durable imagery.

47. **River** — Joni Mitchell

* Genre tags: singer-songwriter
* Overall rating band: **Standout**
* Primary strength/failure mode: emotional economy / imagery
* Confidence: **High**
* Notes: exceptional compression and seasonal-emotional mapping.

48. **Tangled Up in Blue** — Bob Dylan

* Genre tags: folk-rock
* Overall rating band: **Standout**
* Primary strength/failure mode: narrative movement / voice
* Confidence: **High**
* Notes: masterclass in storytelling and shifting perspective.

49. **Famous Blue Raincoat** — Leonard Cohen

* Genre tags: singer-songwriter
* Overall rating band: **Standout**
* Primary strength/failure mode: ambiguity / emotional complexity
* Confidence: **High**
* Notes: exceptional example of lyric intelligence and unresolved tension.

50. **Sam Stone** — John Prine

* Genre tags: folk, country
* Overall rating band: **Standout**
* Primary strength/failure mode: character writing / devastating detail
* Confidence: **High**
* Notes: elite benchmark for humane narrative songwriting.

51. **Pancho and Lefty** — Townes Van Zandt

* Genre tags: folk, country
* Overall rating band: **Standout**
* Primary strength/failure mode: mythic compression / scene economy
* Confidence: **High**
* Notes: extraordinary example of narrative elegance.

52. **He Stopped Loving Her Today** — George Jones

* Genre tags: country
* Overall rating band: **Standout**
* Primary strength/failure mode: emotional payoff / structural precision
* Confidence: **High**
* Notes: canonical high-water mark in country lyric storytelling.

53. **Kate McCannon** — Colter Wall

* Genre tags: folk-country, narrative ballad
* Overall rating band: **Standout**
* Primary strength/failure mode: vivid ballad storytelling
* Confidence: **Medium-High**
* Notes: useful modern narrative anchor with old-ballad energy.

54. **A Day in the Life** — The Beatles

* Genre tags: art rock
* Overall rating band: **Standout**
* Primary strength/failure mode: formal ambition / unforgettable imagery
* Confidence: **High**
* Notes: standout example of structure and surreal concreteness.

55. **Life on Mars?** — David Bowie

* Genre tags: art pop, glam rock
* Overall rating band: **Standout**
* Primary strength/failure mode: surreal but controlled imagery
* Confidence: **High**
* Notes: ideal for testing imaginative language that still feels intentional.

56. **Casimir Pulaski Day** — Sufjan Stevens

* Genre tags: indie folk
* Overall rating band: **Standout**
* Primary strength/failure mode: intimate detail / spiritual-emotional depth
* Confidence: **High**
* Notes: one of the best modern examples of devastating lyrical specificity.

57. **NY State of Mind** — Nas

* Genre tags: hip-hop
* Overall rating band: **Standout**
* Primary strength/failure mode: scene painting / verbal precision
* Confidence: **High**
* Notes: essential rap standout anchor.

58. **Sing About Me, I’m Dying of Thirst** — Kendrick Lamar

* Genre tags: hip-hop
* Overall rating band: **Standout**
* Primary strength/failure mode: perspective, scope, emotional ethics
* Confidence: **High**
* Notes: top-tier narrative and moral complexity.

59. **Dancing on My Own** — Robyn

* Genre tags: synth-pop, dance-pop
* Overall rating band: **Standout**
* Primary strength/failure mode: emotional precision in pop form
* Confidence: **High**
* Notes: crucial proof that direct pop writing can be elite.

60. **Call Your Girlfriend** — Robyn

* Genre tags: synth-pop, dance-pop
* Overall rating band: **Standout**
* Primary strength/failure mode: concept execution / emotional intelligence
* Confidence: **High**
* Notes: another vital standout pop anchor—clear, humane, and sharply written.

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
