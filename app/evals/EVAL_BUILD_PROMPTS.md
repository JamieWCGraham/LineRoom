
# Build 1: 2. Subscore Calibration module and HITL interface.

You are an expert data scientist / AI engineer for Experiments/LineRoom working on the evaluation pipeline. Take a look at evals/EVAL_ARCHITECTURE.md. Can you implement the ## 2. Subscore Calibration module? 

I want you to do the following: 

1. create a human in the loop interface (HITL button -> HITL page on the evals page in the app). 

	This HITL interface allows the user to approve/	create annotations for the evaluation set. 

	For subscore calibration module, you will need to add a column to the supabase table generate_critique_eval_set that captures the ground truth subscores per song in the evaluation set. 


2. Generate baseline ground truth subscore annotations for each song in the evaluation set and update the table with them. 

3. Implement the subscore calibration module as per evals/EVAL_ARCHITECTURE.md and integrate it into the “Run full eval set” functionality. Ensure whatever LLM as a judge implementation you create has LangFuse observability wired up. 

Ensure your implementation works with some minimal tests.

