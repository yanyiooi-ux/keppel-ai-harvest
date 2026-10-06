# Interview guide: 25 minutes with anyone who has worked with office air-con

For YY or a teammate. Works with a technician, an M&E engineer, a facilities manager, a building services lecturer, or a friend in property management. If you record one, send the transcript to Claude: it replaces `composed-interview.md` and its rules get marked as from a real interview.

## Before you start

Hi, thanks for giving me 25 minutes. I am building a small AI helper for a Tencent Cloud hackathon. It helps building technicians deal with repeat "too hot, too cold" complaints in office towers, the way an experienced chief engineer would. I am not a building person, so you are the expert here and I am the student. There are no right or wrong answers. I am not testing you, and I will not name you, your company or any building. I mostly want real stories: what you actually did, what you noticed, and what newer people get wrong. If something is confidential, just say "skip". I will keep an eye on the time so we finish on 25 minutes.

**Recording consent:** Is it okay if I record the audio, only so I can write my notes properly? I will not share the recording, I will not use your name, and you can say stop at any time.

## The questions

### 1. 1. Warm-up. What is your job now, and how often do you deal with air-con comfort complaints in offices? (1.5 min)

- **Why ask:** Tells you what kind of expert you have (hands-on technician, engineer, manager, teacher) so you know which later questions will get the richest answers. Also relaxes them.
- **Follow-ups:** How many years have you done this? / Which kinds of buildings: office towers, malls, schools, condos? / Are you the one who goes up to the floor, the one who looks at the computer screen, or the one who approves things?
- **A good answer sounds like:** A clear role and years. Note if they work with a central building control computer (BMS) and big ducted systems, because that matches our Level 23 story better than home split units.

### 2. 2. If you had to break "handling a repeat comfort complaint" into 3 to 6 big steps, what would they be? Which of those steps needs the most thinking or judgement? (2.5 min)

- **Why ask:** This is the ACTA "task diagram": it gives you the skeleton of their checklist in their own words, and the hard step tells you where to spend the rest of the interview.
- **Follow-ups:** Which step do newer people rush or skip? / Where in those steps do you look at the history, like past complaints or recent renovation? / At which step does someone senior have to say yes?
- **A good answer sounds like:** Steps that roughly match ours: safety, context, remote check on the computer, check on the floor, fix, follow up. Write down any step they add that we do not have. A good answer points to a judgement step like "working out if it is a real fault or a one-off".

### 3. 3. Tell me about the last time, or the toughest time, a tenant kept complaining about the same floor being too hot or too cold. Walk me through what happened from the first complaint to the end. (3.5 min)

- **Why ask:** This is the heart of the Critical Decision Method: one real incident from their own experience, told in order. Real stories carry the know-how that general advice leaves out.
- **Follow-ups:** Roughly how many complaints before someone looked deeper? / Let me check the order: first this happened, then that. Did I get it right? / Where were the key moments when you had to decide something? / How did it finally end?
- **A good answer sounds like:** A specific story with a place, a time and a turning point, not "usually we...". The best answers name a hidden cause, for example renovation walls that cut off the air supply, a temperature sensor left in the wrong room, a stuck air valve box above the ceiling, or afternoon sun on glass.

### 4. 4. In that story, what was the first clue that told you this was not just "turn the temperature down 1 degree"? (3 min)

- **Why ask:** The "deepening" sweep of the Critical Decision Method. Experts notice cues that newcomers miss. Those cues become the questions our AI asks.
- **Follow-ups:** What did you see, hear, feel or read on the screen? / What did you expect to see that was missing? / Did the complaint pattern by time of day tell you anything, like cold mornings and hot afternoons? / What would a newcomer have concluded from the same clue?
- **A good answer sounds like:** Concrete cues: complaints that repeat at the same time of day, cold in the middle of the floor but hot by the windows, a room that only gets hot when full, a temperature reading on the screen that looks fine while people are still uncomfortable, complaints that started after a renovation. A practitioner guide from an engineering firm (CCC Engineering) says comfort complaints after a fit-out change can be a design problem, not a broken machine. Listen for whether they say the same.

### 5. 5. Before you touch anything, what do you check first, for safety and for background? (2 min)

- **Why ask:** Tests our checklist order (safety first, then context). Shows what a veteran makes sure of before acting, and which background facts matter, like after-hours use or a recent renovation.
- **Follow-ups:** Is there any safety reason to stop before going into the ceiling or touching equipment? / Do you ask whether there was a recent renovation, new rooms, or more people on the floor? / Do you check if the tenant runs the air-con after hours or has its own extra units? / Which questions should the helpdesk ask the tenant when the complaint first comes in?
- **A good answer sounds like:** Practical safety points, like working at height, permits, isolating power. Background questions that we can turn into the helpdesk's 3 intake questions: which room, what time of day, since when, anything changed recently. If they name 3 intake questions, write them down word for word.

### 6. 6. If you can see the building control computer (the BMS), what do you look at first, and when have you NOT trusted what the screen said? (2.5 min)

- **Why ask:** Our story has the BMS operator pull a 2-week trend first. ACTA has a probe for when equipment misleads, because newcomers believe the screen and experts know when to doubt it.
- **Follow-ups:** How far back do you look: a day, a week, two weeks? / Which numbers matter most: room temperature, setpoint, how open the air valve is, supply air temperature? / Tell me about a time a sensor was reading wrong or sitting in the wrong place. / How do you check the screen against the real room?
- **A good answer sounds like:** Looking at trends over days, not one number now. Comparing temperature against how open the air valve box is: for example the valve says 100% open but the room stays hot, or nothing changes when they change the setting. Doubting a sensor that sits in a different room from the people complaining.

### 7. 7. Let me read you a short made-up case. Tell me out loud what you think is going on and what you would do first, second and third. (Read: "Level 23, fifth complaint in three weeks. Mornings freezing near the lift core. Afternoons stuffy in a new west-facing glass boardroom built in a recent renovation. A new technician measured at one desk, turned the setting down 1 degree and closed the ticket as adjusted.") (3.5 min)

- **Why ask:** This is the ACTA "simulation interview": a set scenario lets you compare different experts on the exact same problem, and it tests our demo story directly.
- **Follow-ups:** What are your top 2 or 3 guesses for the cause? / What one check would tell your guesses apart fastest? / What did the new technician get wrong? / Who do you need to involve, and when? / How would you tell the tenant what is happening?
- **A good answer sounds like:** More than one possible cause, then a check to tell them apart. For example: did the renovation leave the boardroom without its own sensor or enough air; is the morning cold because the central area gets too much air while the system works hard for the sunny west side; is a valve box stuck. Bonus if they say the 1-degree change could make one area better and another worse.

### 8. 8. What do newcomers usually get wrong with comfort complaints? (2 min)

- **Why ask:** ACTA and the Critical Decision Method both probe expert-versus-novice differences. These mistakes become the warnings the AI shows the technician.
- **Follow-ups:** Can you give one real example? / Why do they make that mistake: time pressure, targets, or not knowing the history? / How would you teach them to avoid it in one sentence?
- **A good answer sounds like:** Mistakes like: changing the setting without finding the cause, measuring at only one spot, closing the job to hit a target, not reading the past complaints, not asking about a recent renovation, blaming the tenant. A good answer comes with a one-line rule you can quote.

### 9. 9. What would you never do, or never let a junior do without asking someone first? (2 min)

- **Why ask:** This tests our green, amber and red steps: green is just do it, amber needs a named person to say yes, red is stop and call someone. It also checks our rules that the AI never writes to building systems, never quotes prices and never admits blame.
- **Follow-ups:** Which changes need the chief engineer's yes? / When do you have to stop and call someone straight away? / Is there anything you would never say to a tenant, like admitting fault or quoting a cost? / Has anyone ever done one of these and caused a bigger problem?
- **A good answer sounds like:** Clear lines, for example: changing settings for a whole air-handling unit or main plant needs a senior yes; anything electrical or at height needs proper permits; costs, blame and lease issues go to the manager on the owner's side. Write down any rule that is stricter or looser than ours.

### 10. 10. How do you actually stop the back-and-forth, so the same floor does not keep complaining? (1.5 min)

- **Why ask:** This is the payoff of the demo: what "solved" looks like to an expert, and how they close the loop with the tenant.
- **Follow-ups:** How do you know it is really fixed and not just quiet for a week? / Do you follow up with the tenant after some days? / What do you write in the job record so the next person knows the history?
- **A good answer sounds like:** Checking the trend again after the fix, a follow-up with the tenant after a few days, and a written note of the real cause so the next technician sees it. A weak answer is "we adjust and close".

### 11. 11. Wrap-up. What should I have asked you but did not? And is there someone else I should talk to? (1 min)

- **Why ask:** Catches anything important the guide missed, and may give you a second expert at short notice.
- **Follow-ups:** Any common cause of hot or cold complaints we have not talked about? / Would you be okay if I sent you our checklist later to look over?
- **A good answer sounds like:** A new cause or rule you had not heard, and a name or a contact for a second interview.

## Where to find someone at short notice

- LinkedIn people search with Singapore as the location, using job titles: "Chief Engineer" (building), "M&E Manager", "Building Manager", "Facilities Manager", "ACMV Technician", "BMS Engineer" or "BMS Operator", "Property Manager". Send a short note: student hackathon, 25 minutes, no names used.
- Singapore Polytechnic, Diploma in Facilities Management (School of Architecture and the Built Environment). Lecturers there teach building services, including air-con. Use the staff contacts or the course page to email the course team. Page: https://www.sp.edu.sg/courses/schools/abe/facilities-management
- Temasek Polytechnic, Diploma in Integrated Facility Management (T28), School of Engineering. Email the course team for one lecturer. Page: https://www.tp.edu.sg/schools-and-courses/students/schools/eng/integrated-facility-management.html
- BCA Academy (Building and Construction Authority's training school). It runs diplomas and short air-con courses, so its trainers know the basics well. Page: https://www.bcaa.edu.sg/what-we-offer/courses
- ASHRAE Singapore Chapter, the local group for air-con engineers. Its website lists a contact email and runs events and talks. Ask if a member can spare 25 minutes for a student project. Site: https://www.ashrae.org.sg/
- SIFMA (Singapore International Facility Management Association), the local FM industry body, which has company and individual members. Ask the secretariat to point you to a member. Site: http://www.sifma.org.sg/about-us/
- ITE graduates or lecturers from the Nitec in Building Services Technology (Air-conditioning and Refrigeration) or Facility Technology. These are the hands-on technicians. Ask friends or family if they know one.
- The management office of the building you or a friend works in. Building managers and on-site technicians often have 10 minutes after a job, especially if you say it is for a student hackathon.
- Friends who work in property, real estate, or a condo managing agent office. Even if they are not engineers, they usually know a technician or building manager they can ask.
- Fallback, only if no one is free: post the Level 23 case on r/HVAC or r/facilitiesmanagement and ask how they would approach it. Label anything from there as practitioner opinion, not expert interview.

## Method sources

- [Applied cognitive task analysis (ACTA): a practitioner's toolkit for understanding cognitive task demands, Militello and Hutton, Klein Associates (copy of the 1998 paper, hosted on a third-party site)](https://assets.super.so/0ace7157-3bf6-491e-a8e0-fe9e6715c2db/files/eb1e3fa9-c697-4632-b91c-ef28a428466c.pdf): The original ACTA paper. It has four parts: a task diagram (ask the expert to break the task into more than 3 but fewer than 6 steps, then say which steps need hard thinking), a knowledge audit (probes about what experts notice, the big picture, anomalies, and when equipment misleads), a simulation interview (give a challenging scenario and probe how they size it up and what a novice would likely get wrong), and a cognitive demands table to sum up. Basis for Q2, Q6, Q7 and Q8.
- [An Easier Method for Extracting Tacit Knowledge, Commoncog](https://commoncog.com/an-easier-method-for-extracting-tacit-knowledge/): Plain-English walk-through of ACTA. Lists the knowledge audit probes with sample wording, such as Past and Future, Big Picture, Noticing, Job Smarts, Anomalies and Equipment Difficulties, where novices believe whatever the equipment tells them. Says a simulation does not need to be realistic, it just needs to be challenging, and suggests running the same simulation with several experts.
- [Decision-Making, Sieck and Klein, chapter in a handbook of applied cognition (Klein Associates)](https://www.globalcognition.org/articles/sieck-AppCog07-decision-making.pdf): Calls the Critical Decision Method one of the most central cognitive task analysis interview methods, built on Flanagan's 1954 critical incident technique. The interview is organised around one real incident from the person's own experience, then three more sweeps: timeline and decision points, progressive deepening (cues, how they read the situation, expectations, goals, options), and "what if" questions about how things could have gone differently and likely errors. Basis for Q3, Q4 and the what-if part of Q7 and Q9.
- [Redundant Deliberation about Negative Consequences: Decision Inertia in Emergency Responders, Power and Alison (accepted manuscript, Lancaster University)](https://eprints.lancs.ac.uk/id/eprint/83139/2/PPP_L_R2_Accepted_Version_Full.pdf): A real study that used the Critical Decision Method with 31 UK police, fire and ambulance commanders. It lists the four sweeps: incident identification, timeline verification, deepening probes, and "what if" probes such as what a novice would do differently. Shows the method used in practice with working professionals.
- [The Critical Incident Technique in UX, Nielsen Norman Group](https://www.nngroup.com/articles/critical-incident-technique/): Explains the difference between "tell me about a time", "tell me about the last time" (most recent, not always critical) and a true critical incident question. Says to give people time to recall, to avoid leading questions, and warns that memory is fallible and people tend to recall extreme events. Supports the "last time or toughest time" wording in Q3.
- [Critical incident technique, Wikipedia](https://en.wikipedia.org/wiki/Critical_incident_technique): Background: the method comes from John Flanagan's 1954 paper in Psychological Bulletin. People are asked to tell a story about an experience that made a positive or negative difference to an outcome.
- [Gary A. Klein, Wikipedia](https://en.wikipedia.org/wiki/Gary_A._Klein): Background on the researcher behind naturalistic decision making. It says that researcher's teams developed cognitive task analysis methods for uncovering tacit knowledge, including the Critical Decision Method and the Knowledge Audit.
- [Air Conditioning Troubleshooting Guide for Building Managers, CCC Engineering (Australian engineering firm; domain cross-check, not a method source)](https://cccengineering.com.au/design-memos/air-conditioning-troubleshooting-commercial/): Used only to judge good answers. Its steps: measure first, then check the controls and the last 24 to 48 hours of BMS trends, then inspect equipment. It says comfort complaints after a fit-out change may be a design problem, not a broken machine, and that a thermostat on a sun-exposed wall can cause trouble.
- [VAV Box Airflow Problems: Complete Troubleshooting Guide, ControlsHub (domain cross-check, vendor-style blog)](https://controlshub.tech/en/blog/66-vav-box-airflow-problems/): Used only to judge good answers about the air valve boxes above the ceiling (VAV boxes). One check it gives: from the control computer, command the damper fully open and watch whether the position reading changes. If it does not, there is an electrical or mechanical fault.
