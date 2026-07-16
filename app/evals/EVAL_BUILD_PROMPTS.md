
# Build 1: 2. Subscore Calibration module and HITL interface.

You are an expert data scientist / AI engineer for Experiments/LineRoom working on the evaluation pipeline. Take a look at evals/EVAL_ARCHITECTURE.md. Can you implement the ## 2. Subscore Calibration module? 

I want you to do the following: 

1. create a human in the loop interface (HITL button -> HITL page on the evals page in the app) to include annotations for this module. 

	This HITL interface allows the user to approve/	create annotations for the evaluation set which save back into supabase.

	For subscore calibration module, you will need to add a column to the supabase table generate_critique_eval_set that captures the ground truth subscores per song in the evaluation set. 


2. Generate baseline ground truth subscore annotations for each song in the evaluation set and update the table with them. 

3. Implement the subscore calibration module as per evals/EVAL_ARCHITECTURE.md and integrate it into the “Run full eval set” functionality. Ensure whatever LLM as a judge implementation you create has LangFuse observability wired up. 

Ensure your implementation works with some minimal tests.



# Build 2: 3. Top Weaknesses / Strengths

You are an expert data scientist / AI engineer for Experiments/LineRoom working on the evaluation pipeline. Take a look at evals/EVAL_ARCHITECTURE.md. Can you implement the ## 3. Top Weaknesses / Strengths module?

I want you to do the following: 

1. modify the human in the loop interface (HITL button -> HITL page on the evals page in the app) to include annotations for this module. 

	This HITL interface allows the user to approve/	create annotations for the evaluation set which save back into supabase.

	For Top Weaknesses / Strengths calibration module, you will need to add column(s) to the supabase table generate_critique_eval_set that captures the ground truth Top Weaknesses / Strengths per song in the evaluation set. 


2. Generate baseline ground truth Top Weaknesses / Strengths annotations for each song in the evaluation set and update the table with them. 

3. Implement the Top Weaknesses / Strengths calibration module as per evals/EVAL_ARCHITECTURE.md and integrate it into the “Run full eval set” functionality. Ensure whatever LLM as a judge implementation you create has LangFuse observability wired up. 

4. In Show Metrics in Evals, display summary statistics / breakdowns for the evals for Top Weaknesses / Strengths.

Ensure your implementation works with some minimal tests.



# Build 3: 4. Line-Level Feedback Quality

You are an expert data scientist / AI engineer for Experiments/LineRoom working on the evaluation pipeline. Take a look at evals/EVAL_ARCHITECTURE.md. Can you implement the ##  4. Line-Level Feedback Quality module?

I want you to do the following: 

1. modify the human in the loop interface (HITL button -> HITL page on the evals page in the app) to include annotations for this module. 

	This HITL interface allows the user to approve/	create annotations for the evaluation set which save back into supabase.

	For Line-Level Feedback Quality calibration module, you will need to add column(s) to the supabase table generate_critique_eval_set that captures the ground truth Line-Level Feedback Quality per song in the evaluation set. 


2. Generate baseline ground truth Line-Level Feedback Quality annotations for each song in the evaluation set and update the table with them.

3. Implement the Line-Level Feedback Quality calibration module as per evals/EVAL_ARCHITECTURE.md and integrate it into the “Run full eval set” functionality. Ensure whatever LLM as a judge implementation you create has LangFuse observability wired up. 

4. At the bottom of Show Metrics in Evals, display summary statistics / breakdowns for the evals for Line-Level Feedback Quality so that a user can inspect errors at a song-level and also macroscopically across the evaluation set.

Ensure your implementation works with some minimal tests.


# Build 4: 5. Faithfulness / Hallucination Check

You are an expert data scientist / AI engineer for Experiments/LineRoom working on the evaluation pipeline. Read `evals/EVAL_ARCHITECTURE.md` and implement **## 5. Faithfulness / Hallucination Check**.

I want you to do the following:

1. Extend the human-in-the-loop interface (HITL entry from the evals area) so annotators can approve or create reference material for this module, persisted in Supabase.

   For faithfulness, you will likely need column(s) on `generate_critique_eval_set` (and/or related tables) that capture ground-truth signals the judge can compare against—for example reference notes on unsupported claims, invented sections, or a target faithfulness band—aligned with the checks listed in the architecture doc (invented sections, absent themes, misread perspective, overstated structure, false technique attribution).

2. Generate baseline ground-truth annotations for each song in the evaluation set and backfill the table.

3. Implement the faithfulness evaluator as described in **## 5** (hard gate: faithfulness below 4/5; see also **# 3. Hard Failure Gates**). Integrate it into “Run full eval set”, with LangFuse on the LLM-as-judge path.

4. In Show Metrics on Evals, surface summary stats and any recurring failure patterns (e.g. unsupported structural claims) consistent with **# 3. Hard Failure Gates** and the `faithfulness_eval` block in **# 4. Suggested Evaluation Output Schema**.

Ensure the implementation includes minimal tests.


# Build 5: 6. Taste Alignment

You are an expert data scientist / AI engineer for Experiments/LineRoom working on the evaluation pipeline. Read `evals/EVAL_ARCHITECTURE.md` and implement **## 6. Taste Alignment**.

I want you to do the following:

1. Extend the HITL interface so annotators can record taste-reference judgments that save to Supabase—for example expected alignment with LineRoom values (specificity, restraint, genre awareness, etc.) and whether `workshop_brain_overcorrection` or similar flags should apply, per **## 6** and the `taste_alignment_eval` schema in **# 4. Suggested Evaluation Output Schema**.

2. Generate baseline ground-truth taste annotations for the evaluation set and update the table.

3. Implement the taste-alignment module per **## 6** (evaluator should account for genre, performance, repetition, musical function, cumulative effect). Wire it into “Run full eval set” with LangFuse observability on judge calls.

4. In Show Metrics, display aggregates and flag breakdowns (e.g. `workshop_brain_overcorrection`) as suggested in **# 6. Build Order** → **Phase 3: Regression dashboard** (failure modes to monitor).

Ensure minimal tests cover the happy path and at least one flagged case.


# Build 6: 7. Usefulness / Product Quality

You are an expert data scientist / AI engineer for Experiments/LineRoom working on the evaluation pipeline. Read `evals/EVAL_ARCHITECTURE.md` and implement **## 7. Usefulness / Product Quality**.

I want you to do the following:

1. Extend the HITL interface so annotators can capture ground-truth or rubric anchors for usefulness (clarity, revision leverage, preservation guidance, prioritization, tone, confidence calibration)—see the criteria and “good critique” checklist in **## 7**—stored on `generate_critique_eval_set` or an appropriate related table.

2. Generate baseline usefulness annotations for each eval-set song and backfill.

3. Implement the usefulness evaluator per **## 7**, integrate into “Run full eval set”, and add LangFuse to the judge implementation.

4. In Show Metrics, show summary statistics for usefulness and tie-ins to composite weighting from **# 2. Recommended Composite Score** (usefulness is 5% of `critique_quality_score` there—preserve module scores separately as the doc requires).

Ensure minimal tests.

When wiring the full pipeline, keep **# 2. Recommended Composite Score** and **# 3. Hard Failure Gates** in mind so `critique_quality_score` and per-module scores stay consistent with the architecture.
