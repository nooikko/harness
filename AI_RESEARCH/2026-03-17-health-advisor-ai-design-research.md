# Research: Health Advisor AI Agent Design
Date: 2026-03-17

## Summary

Comprehensive research into best practices for designing a personal health knowledge assistant that helps users understand blood work, track biomarker trends, optimize daily routines, prepare for doctor appointments, and understand medical terminology — without crossing into medical diagnosis or clinical advice.

## Prior Research
None on this topic. First research file.

---

## Current Findings

### 1. Regulatory Landscape — FDA Guidance (January 2026)

**Confidence: HIGH** — Based on FDA final guidance documents published January 6, 2026.

The FDA issued updated guidance on General Wellness Products and Clinical Decision Support Software that directly governs AI health assistants like Health Advisor.

**What does NOT require FDA oversight (safe for Health Advisor):**
- Apps that promote healthy lifestyles without making disease claims
- Blood test result display with educational explanations, when framed as wellness not diagnosis
- Non-invasive sensing outputs (heart rate, activity, sleep) intended "solely for wellness uses"
- Notifications suggesting HCP evaluation when values fall outside ranges (the key verb is "suggesting," not "directing" or "requiring")
- Biomarker trend visualization and longitudinal tracking

**Language that TRIGGERS FDA medical device regulation (must avoid):**
- References to "specific diseases, clinical conditions or diagnostic thresholds"
- "Alerts, alarms or prompts that recommend or require specific clinical action"
- Claims of "clinical grade" accuracy or equivalence to FDA-approved devices
- Statements targeting "diagnosis, screening, monitoring or management of a disease"
- Treatment guidance or autonomous clinical decision-making

**Key principle from FDA guidance:** Products gain safe harbor by ensuring outputs are not "the sole or primary basis for clinical action" and that users (or clinicians) can "independently review the basis for recommendations."

**Practical implication for Health Advisor:** Frame all outputs as educational context and informed questions, not clinical directives. Language like "this may be worth discussing with your doctor" sits squarely in the wellness safe harbor. Language like "your TSH indicates subclinical hypothyroidism requiring treatment" would trigger device regulation.

Sources:
- https://telehealth.org/news/fda-clarifies-oversight-of-ai-health-software-and-wearables-limiting-regulation-of-low-risk-devices/
- https://www.jdsupra.com/legalnews/ringing-in-the-new-year-with-digital-5307049/
- https://www.aha.org/news/headline/2026-01-06-fda-issues-guidance-wellness-products-clinical-decision-support-software

---

### 2. Effective Disclaimers — What Works vs. What Doesn't

**Confidence: MEDIUM** — Research on disclaimer effectiveness in health AI is limited; most studies focus on clinical AI, not consumer wellness.

**The problem with generic disclaimers:**
Research from PMC (2025) on ethical AI in healthcare notes that standard "not medical advice" boilerplate fails to achieve genuine informed consent. Patients need information about AI involvement, limitations, and their rights — not just legal cover language. Blanket disclaimers create the appearance of responsibility without genuine user understanding.

**What fails:**
- Front-loading disclaimers before every response ("I am not a doctor and this is not medical advice...") — creates friction, teaches users to scroll past, and signals the system doesn't trust itself
- Dismissive hedging that renders the response useless ("I can't comment on your lab results, please see a doctor")
- Inconsistent application (some responses disclaim, others don't)
- Generic disclaimers that don't address the specific limitation at hand

**What works (from production health AI patterns):**
- **Contextual, embedded scope signals** rather than upfront boilerplate. Not "this is not medical advice" but "here's what the research says about TSH ranges — your doctor can interpret this in the context of your symptoms and history."
- **Confidence-calibrated language** that varies based on evidence strength: "strong evidence suggests..." vs. "some studies indicate..." vs. "the data is mixed on..."
- **Directional suggestions, not prescriptions**: "A question worth raising with your doctor: whether your TSH trend over the past three tests warrants a full thyroid panel" — gives concrete value without diagnosis
- **Framing as preparation, not substitution**: Consistently position Health Advisor as helping the user be a better participant in their own healthcare, not as replacing it
- **Specific escalation triggers** embedded naturally: "If you're experiencing [symptoms], that warrants an urgent call to your doctor rather than waiting for your next scheduled visit"

**InsideTracker's production approach (observed pattern):**
- Uses zone language ("at-risk zone," "optimal zone," "normal zone") instead of disease language
- At-risk zone explicitly flagged as "best addressed with a healthcare provider"
- All recommendations linked to peer-reviewed publications
- Frames personalization as the value-add: recommendations based on "your age, sex, ethnicity, and physical activity level" — not on clinical judgment

**The design principle that resolves the tension:**
Genuine helpfulness and responsibility are not opposites. The right model is "brilliant friend who happens to know a lot about health" — someone who gives you real information in understandable terms, helps you understand your situation, and knows when to say "this really needs your doctor's eyes." The failure mode is being so cautious you provide no value; the other failure mode is playing doctor.

Sources:
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12076083/
- https://blog.insidetracker.com/biomarkers-going-beyond-normal
- https://blog.insidetracker.com/your-optimal-zones-new-and-improved

---

### 3. Blood Work Interpretation Frameworks

**Confidence: HIGH** — Multiple functional medicine sources and one PMC peer-reviewed paper agree on the core framework.

**Conventional Reference Ranges vs. Functional/Optimal Ranges:**

Conventional reference ranges are population-statistical (95% bell curve), designed to detect overt disease. They include people with chronic illness in the "normal" population, so someone can be "normal" by conventional standards while experiencing early metabolic dysfunction.

Functional/optimal ranges are narrower, based on values associated with optimal physiological function in healthy, well-characterized populations.

**Key examples where the gap matters most:**

| Biomarker | Conventional "Normal" | Functional Optimal | Why It Matters |
|---|---|---|---|
| TSH (thyroid) | 0.5–4.5 mIU/L | 1.0–2.5 mIU/L | Higher TSH within "normal" correlates with subclinical hypothyroid symptoms |
| Fasting glucose | <100 mg/dL | 70–85 mg/dL | Early insulin resistance detectable before prediabetes threshold |
| Vitamin D (25-OH) | >20 ng/mL | 50–80 ng/mL | Significant immunity/bone benefits in higher range |
| Ferritin | 12–300 ng/mL (men) | 50–150 ng/mL | Low-normal ferritin causes fatigue, hair loss, cognitive issues |
| hs-CRP | <3.0 mg/L | <1.0 mg/L | Optimal cardiovascular risk assessment |

**System-based interpretation approach (from functional medicine):**
Rather than evaluating each biomarker in isolation, interpret patterns across interconnected systems:
- Thyroid: TSH + Free T3 + Free T4 + Reverse T3 + TPO antibodies together
- Metabolic: Fasting glucose + fasting insulin + HbA1c + triglyceride:HDL ratio
- Inflammation: hs-CRP + homocysteine + ferritin pattern
- Lipid: LDL-C + ApoB + Lp(a) + particle size + HDL function

**Practical framing for Health Advisor:**
Always present BOTH the conventional reference range (what labs report) AND the functional optimal range (what research suggests for thriving). Make the distinction explicit. Example language: "Your lab's reference range for TSH is 0.5–4.5. Your result of 3.8 is within their 'normal' range. However, many practitioners focused on optimization aim for 1.0–2.5, as research associates higher-normal TSH with fatigue and metabolic symptoms. Whether your TSH warrants attention is worth discussing with your doctor."

**The honest uncertainty to communicate:**
Functional ranges are not universally agreed upon. They represent an emerging, evidence-based perspective, not official medical consensus. Health Advisor should explicitly acknowledge this: "These optimal ranges are derived from research on healthy populations and are used by functional medicine practitioners — they may differ from what your conventional doctor uses."

Sources:
- https://fullscript.com/blog/lab-interpretation-in-functional-medicine
- https://www.rupahealth.com/post/how-functional-medicine-provider-look-at-optimal-lab-ranges
- https://pmc.ncbi.nlm.nih.gov/articles/PMC10151278/ (PMC peer-reviewed: "Functional Reference Limits: Describing Physiological Relationships")

---

### 4. Production Health AI Patterns — InsideTracker, SiPhox, Function Health

**Confidence: MEDIUM** — Based on published descriptions and comparison reviews; direct product inspection was limited.

**InsideTracker (most mature, most documented):**
- Scope: 48 biomarkers, 7,000+ curated clinical studies, AI engine called "SegterraX"
- Zone system: at-risk (red) / normal (yellow) / optimal (green) / optimized (blue)
- At-risk explicitly flagged: "best addressed with a healthcare provider"
- Personalization factors: age, sex, ethnicity, activity level, lifestyle goals
- Recommendations ranked by "impact score" combining biomarker level + strength of science
- All recommendations cite the original peer-reviewed publication
- Key insight: they frame their value as going beyond "normal" toward optimal — this is the core business proposition and communication philosophy
- Does NOT provide disease diagnoses — frames everything as wellness optimization

**SiPhox Health:**
- Scope: 17 biomarkers, includes 6 "aging biomarkers"
- Clinician review of AI recommendations before user delivery — builds trust through human-in-loop
- Integration with 300+ devices (Apple Watch, Oura, CGMs) for context-enriched interpretation
- At-home finger prick collection enables more frequent testing

**Function Health:**
- Broader panel (100+ biomarkers), physician-ordered
- Positions as "know your body" comprehensive baseline
- Less AI optimization, more comprehensive data delivery

**Key pattern across all three:**
All frame their service as enabling better doctor conversations, not replacing them. All use personalized zones rather than raw population ranges. All link recommendations to evidence. None make disease claims.

Sources:
- https://mynucleus.com/blog/siphox-health-vs-insidetracker
- https://blog.insidetracker.com/how-we-define-your-optimized-zones-health-and-performance
- https://www.insidetracker.com/science

---

### 5. System Prompt Design for Health Knowledge Assistants

**Confidence: MEDIUM-HIGH** — Drawn from healthcare AI prompt engineering guides and general best practices.

**Core structural principles:**

1. **Establish the role explicitly** — not "a medical AI" but "a health knowledge partner who helps you understand your data and prepare for healthcare conversations." The framing matters because it sets user expectations.

2. **Define the output model** — Health Advisor should be structured to provide:
   - Educational explanation (what does this biomarker mean?)
   - Contextual interpretation (where does your result sit relative to conventional and optimal ranges?)
   - Pattern recognition (how does this relate to other markers?)
   - Trend analysis (how has this changed over time?)
   - Actionable preparation (what questions should you raise with your doctor?)
   - Evidence-graded recommendations (what does the research say about lifestyle factors?)

3. **Evidence grading in the prompt** — Instruct the agent to explicitly grade evidence strength:
   - "Strong evidence (multiple RCTs)..."
   - "Observational evidence suggests..."
   - "Limited studies indicate..."
   - "Individual variation is high here..."

4. **Scope escalation triggers** — Build in explicit rules for when to escalate urgency:
   - Values in the at-risk/critical zone: "This warrants a call to your doctor before your next scheduled appointment"
   - Symptom + biomarker combinations: "If you're experiencing [symptom] alongside this result, that's worth mentioning promptly"
   - Concerning trend acceleration: "Your [marker] has been declining over three tests — this trajectory is worth flagging"

5. **Personalization context use** — The agent should actively use stored data:
   - User's previous test results for trend analysis
   - User's stated health goals for relevance filtering
   - User's current medications/supplements for interaction awareness
   - User's doctor appointments for preparation timing

6. **Avoid these common system prompt failures:**
   - Making the disclaimer the first thing the agent says in every response
   - Over-hedging to the point of providing no value ("I can't interpret your labs")
   - Using clinical jargon without translation
   - Providing one-size-fits-all responses without using the user's specific data
   - Failing to distinguish between "your value is concerning" and "this is worth watching"

Sources:
- https://www.themomentum.ai/blog/effective-ai-prompting-strategies-for-healthcare-applications
- https://bastiongpt.com/post/best-practices-for-healthcare-ai-prompts
- https://github.com/FortaTech/prompts-for-health

---

### 6. Supplement and Routine Recommendations — Evidence Grading

**Confidence: HIGH** — Both research literature and production tools agree on core framework.

**The hierarchy of evidence (most to least reliable):**
1. Multiple systematic reviews / meta-analyses of RCTs
2. Single well-powered RCT
3. Multiple observational studies with consistent findings
4. Single observational study / mechanistic evidence
5. Expert opinion / case reports / animal models

**Explicit evidence-grading language for supplement recommendations:**

- Level A (Strong): "Strong evidence from multiple randomized trials supports [supplement] for [outcome] in people with [your profile]. This is one of the more robustly studied supplements."
- Level B (Moderate): "Several clinical trials support [supplement] for [outcome], though study sizes were small. Worth discussing with your doctor given your [relevant biomarker]."
- Level C (Limited): "Some observational data suggests [supplement] may benefit [outcome], but the evidence is early-stage. Individual responses vary significantly."
- Level D (Emerging/Weak): "This is an area of active research without strong human trial data yet. I'd approach this with caution and wouldn't prioritize it over better-evidenced options."

**Individual variation caveats — when to always include:**
- MTHFR gene variants affect folate/B12 metabolism → methylated forms matter
- Vitamin D receptor variants affect response to supplementation
- Iron status must be confirmed before supplementing (iron overload is harmful)
- Omega-3 dosing response varies by baseline inflammatory status
- Any supplement with drug interactions (fish oil + anticoagulants, St. John's Wort + many medications)

**Key principle:** Always distinguish between addressing a deficiency (high confidence benefit) vs. supraphysiologic supplementation for optimization (much lower confidence, more individual variation).

Sources:
- https://pmc.ncbi.nlm.nih.gov/articles/PMC11243060/ (randomized trial of AI-guided supplement recommendations)
- https://www.droracle.ai/articles/793926/what-are-the-grades-in-recommendations-for-supplement-use
- https://consensus.app/home/blog/how-to-pick-the-right-supplements-for-you/

---

### 7. Longitudinal Trend Analysis and Visualization

**Confidence: HIGH** — Multiple clinical informatics studies agree on core principles.

**Research findings on patient-facing health data visualization:**
- Line graphs are most common but number lines and bar graphs with color are better understood by patients
- Color is the most effective communicator of risk — red/yellow/green zone systems work well
- Multiple time points are significantly more predictive and useful than single measurements
- Interactive features (date range selection, trend annotation) improve interpretation
- Reference range bands displayed on the same chart as the trend line improve context

**For biomarker trend analysis, key patterns Health Advisor should recognize:**

1. **Directional trend within range** — a biomarker moving from optimal toward at-risk over several tests, even if still in range, is a meaningful signal
2. **Rate of change** — how quickly a trend is moving matters as much as current value
3. **Seasonal patterns** — Vitamin D typically decreases in winter; this context prevents false alarms
4. **Intervention response** — after a dietary change or supplement, did the relevant marker improve within the expected timeframe?
5. **Correlated marker patterns** — triglycerides rising as HDL falls together is more significant than either alone

**Language for trend communication:**
- "Your [marker] has been trending [direction] over [timeframe]. While still within [range], the direction is worth watching."
- "Since starting [intervention] in [month], your [marker] has improved from [X] to [Y] — that's consistent with the research on expected response time."
- "This is your first reading for [marker], so we'll need at least 2–3 tests over 6–12 months to identify meaningful patterns."

Sources:
- https://pmc.ncbi.nlm.nih.gov/articles/PMC6785326/ (systematic review: patient-facing health data visualization)
- https://www.nature.com/articles/s41598-018-33008-7 (longitudinal biomarker analysis from personalized nutrition platform)
- https://innresearch.com/visualizing-longitudinal-data-techniques-and-best-practices/

---

### 8. Doctor Appointment Preparation — Best Pattern

**Confidence: MEDIUM** — Based on healthcare communication research and established patient preparation frameworks (AHRQ, Cleveland Clinic, Joint Commission).

**The "question generation" framing is the safest and most valuable Health Advisor use case:**

Multiple major healthcare institutions (Cleveland Clinic, Joint Commission, American Heart Association) specifically advocate for patients coming to appointments with written, prepared questions. This is established good practice that Health Advisor can own explicitly.

**Effective question frameworks for lab result discussions:**
- "What is the trend in my [marker] over time, and is the direction concerning?"
- "My [marker] is [X]. What would need to change for you to consider treatment?"
- "Given my [marker] result, are there lifestyle changes with strong evidence I should try first?"
- "Are there additional tests that would give us a more complete picture of my [system]?"
- "What's the retesting timeline that would tell us whether an intervention is working?"

**Design principle:** Health Advisor should generate a specific, personalized question list before each appointment — tailored to the user's actual data, their reported symptoms, and their stated goals. This is extraordinarily high value and completely within safe scope.

Sources:
- https://www.jointcommission.org/en/knowledge-library/for-patients/takecharge/prepare-for-doctor-visits-and-make-a-list-of-questions/
- https://time.com/7270606/questions-to-ask-doctor-appointment/
- https://www.nia.nih.gov/health/medical-care-and-appointments/what-should-i-ask-my-doctor-during-checkup

---

### 9. Anthropic-Specific Guidance for Health AI

**Confidence: MEDIUM** — Based on public policy documentation; specific system prompt guidance is not published.

Anthropic's Usage Policy classifies healthcare decisions as a "high-risk use case" requiring "additional safety measures." For Claude-based health assistants, this means:

- Organizations should have human review of outputs "prior to dissemination or finalization" in clinical decision contexts (though this applies more to clinical systems than personal wellness assistants)
- Claude is designed to "include contextual disclaimers, acknowledge uncertainty, and direct users to healthcare professionals for personalized guidance"
- Anthropic's Constitutional AI approach explicitly targets reducing hallucinations in medical contexts
- Claude for Healthcare (launched January 2026) targets clinician workflows with HIPAA-ready products — distinct from consumer wellness tools, but indicates Anthropic takes health accuracy seriously

**For a personal wellness assistant on Harness:** The key is framing the agent's role clearly in the soul/identity so Claude's constitutional training reinforces rather than conflicts with the desired behavior. An agent defined as a "health knowledge partner who helps users prepare for doctor conversations" will naturally apply appropriate caution — the soul doesn't need to fight Claude's training.

Sources:
- https://www.anthropic.com/news/updating-our-usage-policy
- https://claude.com/solutions/healthcare
- https://www.anthropic.com/news/healthcare-life-sciences

---

### 10. Patient Empowerment vs. Overreliance — The Core Design Tension

**Confidence: HIGH** — Strong qualitative research from PMC (2025) on patient participation in AI-supported healthcare.

**Research finding (PMC, 2025):** Whether AI-supported health interventions empower or undermine patient participation depends entirely on how they are designed and framed. Patients can feel both oppressed by excessive health monitoring AND genuinely empowered by the same data.

**Concerning patterns that undermine empowerment:**
- Direct notification of alarming results without preparation or context (creates anxiety, not agency)
- AI that feels like "an overlord in their lives"
- Opaque recommendations without reasoning
- Systems that create dependency rather than building health literacy

**Patterns that support genuine empowerment:**
- Explaining the "why" behind every recommendation — builds the user's own understanding
- Respecting passive engagement preferences — not every user wants to be deeply engaged every time
- Demystifying AI involvement — being explicit about what the AI does and doesn't know
- Framing patient knowledge of their own symptoms, goals, and history as genuinely valuable data
- Preserving real choice — the agent offers perspectives, not mandates

**The design implication for Health Advisor's soul:**
The agent should position the user as the expert on their own experience and goals, with Health Advisor providing knowledge infrastructure. Not "I will tell you what your labs mean" but "Let me help you understand what your labs might mean, so you can have an informed conversation with the people who know your full clinical picture."

Sources:
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12089863/
- https://ai.jmir.org/2025/1/e50781/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12659101/

---

## Key Takeaways

### For the Soul/Identity Text

1. **Primary identity**: A knowledgeable health education partner — not a diagnostician, not a generic chatbot, not a replacement for medical care. The "brilliant friend who happens to have deep health science knowledge" model.

2. **Core value proposition**: Closing the knowledge gap between what lab reports say and what they mean; between what patients experience and what they know to ask their doctors about.

3. **Disclaimer philosophy**: Embed scope signals contextually rather than front-loading boilerplate. The soul should make contextual flagging feel natural, not defensive.

4. **Evidence grading**: Explicit and consistent. Always communicate how strong the evidence is for any recommendation.

5. **Personalization as core behavior**: Always use the user's actual data, trends, and context — never generic responses.

6. **Doctor-conversation preparation**: Position this as a signature capability and frame it as the primary output of every health discussion.

### The Three Sentences That Should Never Appear

- "I'm not a doctor and this is not medical advice." (Too defensive, teaches users to ignore it)
- "Please consult your healthcare provider." (Alone, without useful context — dismissive)
- "I can't interpret your lab results." (Abandons the user; the right response is educational interpretation with appropriate framing)

### The Three Patterns That Should Always Appear

- "Here's what the research says about [biomarker], and here's where your result sits relative to both conventional and optimal ranges..."
- "Based on your trend over [timeframe], this is [tracking well / worth watching / worth flagging to your doctor]..."
- "Questions worth raising with your doctor at your next visit: [specific, personalized list]..."

---

## Proposed Soul Text for Health Advisor Agent

Based on all research above, this soul text captures the identity, operating principles, and boundaries:

```
You are a dedicated health knowledge partner — deeply knowledgeable about biomarkers,
physiology, nutrition, sleep science, and evidence-based wellness practices. Your role
is to help one person understand their own health data with nuance, track meaningful
trends over time, and become a more informed participant in their healthcare.

You are not a doctor. You do not diagnose, prescribe, or replace clinical judgment.
What you do is fill the gap between raw data and understanding — the gap that leaves
people staring at lab reports full of numbers they can't interpret, or walking into
doctor appointments without knowing what questions to ask.

Your knowledge spans:
- Blood work interpretation: CBC, comprehensive and basic metabolic panels, lipid
  panels, thyroid function, sex hormones, vitamins, minerals, inflammation markers,
  and specialty tests
- The difference between conventional reference ranges (designed to detect disease)
  and functional optimal ranges (associated with thriving health) — and when that
  distinction matters
- Longitudinal trend interpretation: a single value in isolation is less meaningful
  than the direction and rate of change over time
- Evidence-based lifestyle factors: what sleep, nutrition, exercise, and supplementation
  research actually shows — and with what strength of evidence
- Doctor appointment preparation: generating specific, data-driven questions that
  help the user get more from their clinical appointments

How you communicate:
- You interpret results using real context: the user's full history, trends, goals,
  and reported symptoms — never generic responses to generic questions
- You always present both the conventional reference range and the functional optimal
  range when relevant, and explain why they differ
- You grade your confidence explicitly. Strong RCT evidence gets stated as such.
  Observational findings get stated as such. Emerging or conflicting data gets
  acknowledged as such.
- You flag urgency appropriately. Values that warrant calling a doctor before the
  next scheduled appointment get that specific recommendation — not buried in caveats,
  stated clearly.
- You help the user prepare specific questions for their doctor, framed to get
  maximum value from clinical appointments

What you never do:
- Diagnose a condition
- Tell the user they have or don't have a disease
- Recommend stopping or changing prescribed medications
- Substitute for evaluation of acute symptoms (chest pain, severe headache, sudden
  symptoms warrant immediate medical contact, not a chat session)
- Overstate evidence — if research is limited or conflicting, you say so clearly
```

---

## Gaps Identified

1. **Specific disclaimer effectiveness research**: No randomized or quasi-experimental studies comparing different disclaimer language approaches in consumer health AI. Conclusions are drawn from practitioner consensus and production patterns, not controlled research.

2. **Functional range scientific consensus**: Functional/optimal ranges are not standardized across practitioners. InsideTracker's ranges may differ from what a functional medicine MD uses. Health Advisor should acknowledge this explicitly.

3. **HIPAA considerations for the Harness implementation**: If the Health Advisor stores blood work data, there are privacy considerations around PHI even in a personal-use context. Not researched here — would need legal guidance if building for multiple users.

4. **Interaction effects and contraindications database**: For a truly comprehensive supplement advisor, a structured drug-supplement and supplement-supplement interaction database would be needed. This is beyond what an LLM alone can reliably provide from training data.

5. **Specific Anthropic model behavior in health contexts**: Claude's actual behavior when discussing blood work results has not been tested here. The soul text may need iteration based on observed responses.

---

## Sources

- https://telehealth.org/news/fda-clarifies-oversight-of-ai-health-software-and-wearables-limiting-regulation-of-low-risk-devices/
- https://www.jdsupra.com/legalnews/ringing-in-the-new-year-with-digital-5307049/
- https://www.aha.org/news/headline/2026-01-06-fda-issues-guidance-wellness-products-clinical-decision-support-software
- https://www.lw.com/en/insights/fda-issues-updated-guidance-loosening-regulatory-approach-to-certain-digital-health-tools
- https://natlawreview.com/article/digital-health-policy-fda-relaxes-restrictions-over-wearables-and-ai-decision
- https://fullscript.com/blog/lab-interpretation-in-functional-medicine
- https://www.rupahealth.com/post/how-functional-medicine-provider-look-at-optimal-lab-ranges
- https://pmc.ncbi.nlm.nih.gov/articles/PMC10151278/
- https://blog.insidetracker.com/biomarkers-going-beyond-normal
- https://blog.insidetracker.com/your-optimal-zones-new-and-improved
- https://blog.insidetracker.com/how-we-define-your-optimized-zones-health-and-performance
- https://www.insidetracker.com/science
- https://mynucleus.com/blog/siphox-health-vs-insidetracker
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12076083/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12089863/
- https://ai.jmir.org/2025/1/e50781/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12659101/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC6785326/
- https://www.nature.com/articles/s41598-018-33008-7
- https://pmc.ncbi.nlm.nih.gov/articles/PMC11243060/
- https://www.droracle.ai/articles/793926/what-are-the-grades-in-recommendations-for-supplement-use
- https://www.themomentum.ai/blog/effective-ai-prompting-strategies-for-healthcare-applications
- https://bastiongpt.com/post/best-practices-for-healthcare-ai-prompts
- https://claude.com/solutions/healthcare
- https://www.anthropic.com/news/updating-our-usage-policy
- https://www.jointcommission.org/en/knowledge-library/for-patients/takecharge/prepare-for-doctor-visits-and-make-a-list-of-questions/
