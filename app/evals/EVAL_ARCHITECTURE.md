# LineRoom Critique Evaluation Architecture

## Purpose

LineRoom should predict the correct overall rating. It should generate critiques that are **faithful, useful, specific, calibrated, and aligned with the product’s taste**.

The evaluation system should therefore assess each part of the generated critique separately:

```text
Overall rating
Subscores
Genre principles
Top strengths
Top weaknesses
Line-level feedback
Tone/usefulness
Faithfulness
Taste alignment
```

The goal is to identify *which part* of the critique improved or regressed, rather than hiding everything inside one aggregate score.

---

# 1. Core Evaluation Modules

## 1. Overall Rating Accuracy (This is Already Implemented)

Evaluates whether the generated rating matches the reference label:

```text
Needs Work / Promising / Strong / Standout
```

Track:

```text
exact accuracy
off-by-one-band errors
off-by-two-plus-band errors
confusion matrix
```

Hard failure:

```text
Overall rating is off by 2+ bands.
```

A Confusion Matrix gives us insight into how well the model is doing across the evaluation set. 

---

## 2. Subscore Calibration

Evaluates the seven critique subscores:

```text
emotional_impact
imagery_specificity
originality_voice
prosody_singability
structure_cohesion
lyrical_economy
hook_strength
```

### Evaluation criteria

```text
Reference distance:
How close is each predicted subscore to the expected subscore?

Band consistency:
Do the subscores make sense given the overall rating?

Explanation alignment:
Does the written critique justify the assigned subscores?
```

### Suggested tolerance

```text
0 off = correct
1 off = acceptable
2+ off = failure
```

### Example consistency ranges

```text
Needs Work: mostly 1–2
Promising: mostly 2–3
Strong: mostly 3–4
Standout: mostly 4–5
```

Hard failure:

```text
Subscores are wildly inconsistent with the overall rating or written explanation.
```

---

## 3. Strengths / Weaknesses Quality

Evaluates whether the “Overall strengths” and “Overall weaknesses” are useful.

### Evaluation criteria

```text
Specificity:
Does the point refer to concrete features of the lyric?

Evidence-grounding:
Is the claim supported by actual lyric material?

Non-redundancy:
Do the points identify distinct issues/assets?

Actionability:
Do weaknesses suggest a useful revision direction?

Fairness:
Does the critique avoid nitpicking or overpraising?
```

### Failure flags

```text
generic_praise
generic_criticism
redundant_points
unsupported_claim
missed_major_strength
missed_major_weakness
too_soft
too_harsh
```

Good weakness:

```text
“Everything around me seems to no longer suffice” states the feeling abstractly; replacing it with a concrete object, purchase, or bodily sensation would make the dissatisfaction feel more lived-in.
```

Bad weakness:

```text
Some lines could be stronger.
```

---

## 4. Line-Level Feedback Quality

Evaluates highlighted line notes.

This is one of the most important modules because line notes are where the user most directly feels whether LineRoom is intelligent.

### Evaluation criteria

```text
Coverage:
Did the model comment on the highest-leverage lines?

Label calibration:
Are line labels like Strong / Promising / Suggestion appropriate?

Specificity:
Does the note explain why the line works or does not work?

Revision usefulness:
For weaker lines, does the note suggest a useful direction?

Context awareness:
Does the note understand the line’s role in the larger song?
```

### Lines worth prioritizing

```text
hooks
title lines
structural pivots
best lines
weakest lines
repeated lines
lines with high revision leverage
```

### Suggested scoring

```text
Line-Level Score =
25% coverage
20% label calibration
20% specificity
20% revision usefulness
15% faithfulness/context awareness
```

Hard failure:

```text
Most line notes are generic, mislabeled, or unhelpful.
```

---

## 5. Faithfulness / Hallucination Check

Evaluates whether the critique makes only claims supported by the lyric.

### Checks

```text
Does the critique invent sections that do not exist?
Does it claim themes/images that are not present?
Does it misread the lyric’s perspective?
Does it overstate structural sophistication?
Does it attribute techniques that are not actually there?
```

### Example failure

```text
“The bridge introduces religious imagery.”
```

when there is no bridge or religious imagery.

Faithfulness should be a hard gate.

Hard failure:

```text
Faithfulness score below 4/5.
```

---

## 6. Taste Alignment

Evaluates whether the critique reflects LineRoom’s intended artistic values.

LineRoom should value:

```text
specificity
restraint
fresh phrasing
emotional implication
genre awareness
performance context
lived-in detail
conceptual coherence
structural payoff
```

But it should avoid over-applying literary workshop logic.

### Important failure flag

```text
workshop_brain_overcorrection
```

Definition:

```text
The critique over-penalizes simplicity, repetition, directness, or abstraction because it is judging the lyric too much like a page-poem rather than a song.
```

The evaluator should ask:

```text
Does the critique account for genre, performance, repetition, musical function, and cumulative effect?
```

---

## 7. Usefulness / Product Quality

Evaluates whether the critique would actually help a serious songwriter revise.

### Criteria

```text
Clarity:
Is the critique easy to understand?

Revision leverage:
Does it point to changes that would improve the song?

Preservation guidance:
Does it tell the user what not to ruin?

Prioritization:
Does it distinguish major issues from minor ones?

Tone:
Is it honest without being needlessly discouraging?

Confidence calibration:
Does it avoid sounding certain about subjective calls?
```

A good critique should leave the user thinking:

```text
I know what is working.
I know what is weak.
I know what to preserve.
I know what to revise first.
I trust the judgment.
```

---

# 2. Recommended Composite Score

Create a `critique_quality_score`, but always preserve the module scores separately.

Suggested weighting:

```text
Overall rating accuracy:       20%
Subscore calibration:          15%
Strength/weakness quality:     15%
Line-level feedback quality:   25%
Faithfulness:                  10%
Taste alignment:               10%
Usefulness/tone:                5%
```

Use the composite for tracking progress, but use module scores to diagnose failures.

---

# 3. Hard Failure Gates

A critique should fail automatically if any of these occur:

```text
Faithfulness below 4/5
Overall rating off by 2+ bands
Line-level feedback mostly generic
Critique contradicts itself
Subscores wildly inconsistent with written explanation
Major unsupported claims
Harsh criticism without useful direction
Praise unsupported by lyric evidence
```

---

# 4. Suggested Evaluation Output Schema

```json
{
  "overall_score_eval": {
    "expected": "Strong",
    "predicted": "Strong",
    "correct": true,
    "distance": 0
  },
  "subscore_eval": {
    "mean_absolute_error": 0.4,
    "band_consistency": "pass",
    "explanation_alignment_score": 4
  },
  "strength_weakness_eval": {
    "specificity": 4,
    "evidence_grounding": 5,
    "non_redundancy": 4,
    "actionability": 4,
    "fairness": 4
  },
  "line_feedback_eval": {
    "coverage": 0.85,
    "label_calibration": 0.78,
    "specificity": 4,
    "revision_usefulness": 4,
    "context_awareness": 4
  },
  "faithfulness_eval": {
    "score": 5,
    "unsupported_claims": []
  },
  "taste_alignment_eval": {
    "score": 4,
    "flags": []
  },
  "usefulness_eval": {
    "score": 4,
    "notes": "Clear, specific, and revision-oriented."
  },
  "failure_flags": [],
  "critique_quality_score": 0.86
}
```

---

# 5. Suggested Database Tables

## `critique_evals`

```sql
id
song_id
critique_id
model_version
prompt_version
overall_expected
overall_predicted
overall_correct
overall_distance
subscore_mae
subscore_band_consistency
strengths_score
weaknesses_score
line_feedback_score
faithfulness_score
taste_alignment_score
usefulness_score
critique_quality_score
failure_flags
evaluator_model
created_at
```

## `line_feedback_evals`

```sql
id
critique_eval_id
line_text
expected_label
predicted_label
label_correct
specificity_score
usefulness_score
faithfulness_score
context_awareness_score
comment
```

---

# 6. Build Order

## Phase 1: Minimum viable eval expansion

Build these first:

```text
1. Subscore band-consistency check
2. Faithfulness / hallucination evaluator
3. Strength/weakness specificity evaluator
4. Line-level label calibration
5. Usefulness evaluator
```

This gives the most signal without overbuilding.

---

## Phase 2: Add deeper reference data

Create human/reference annotations for:

```text
expected subscores
must-comment lines
optional-comment lines
expected line labels
known major strengths
known major weaknesses
```

This makes line-level and subscore evals much more reliable.

---

## Phase 3: Regression dashboard

Track by:

```text
model version
prompt version
genre
overall rating band
failure flag
subscore dimension
line-feedback quality
```

Useful recurring failure modes to monitor:

```text
overrating polished generic songs
underrating simple/performance-dependent songs
over-penalizing abstraction
over-rewarding strong concepts
generic line notes
unsupported structural claims
subscores not matching explanation
workshop_brain_overcorrection
```

---

# 7. North Star

LineRoom’s critique eval should not ask only:

```text
Did the model sound sophisticated?
```

It should ask:

```text
Did the critique help a serious songwriter preserve what is alive, identify what is weak, and make the next revision better?
```

The system should reward:

```text
faithfulness
specificity
fairness
taste
revision leverage
genre awareness
calibrated confidence
```

And punish:

```text
generic workshop advice
unsupported claims
miscalibrated praise
overly literary literalism
rubric inconsistency
unhelpful line notes
```
