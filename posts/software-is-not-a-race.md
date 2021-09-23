---
title: Software Is Not A Race
date: 2021-08-12T18:00:29+10:00
---

Too often I see people building software and doing changes in an existing piece of code as if they're texting one...excruciating...line...at...a...time. As if it's important to get one disjointed piece of functionality out and making up what's next on the go.

This is bad. Software like any other piece of well thought out functionality should be **deliberate**. Don't rush into adding a change because the current circumstances confirm it. Check if the change needs to be done based on the requirements of the system. Confirm it with your teammates. More often than not, you will realise that you have missed a key detail of the system. And that the change can be done in another part of the system or not needed at all.

I have long held the belief that a key and critical milestone in the path of young precocious programmer progressing from making computers go *bleep blop* to building programming megastructures, is the ability to pause and question, deeply, pragmatically, WHY. It's easy to forget in the pace of building a new systems and delivering rapid value, that the best software is the one that's not needed at all. Each extra line of code in the system brings with itself an extra line to maintain and code reading overhead.

Since most of the code ever written is write once and maintain/read many times - it is imperative to question the need. Each line of code needs to earn its place there and should have a rock solid reason to be there.

There are some good strategies that can be applied to enable well thought out software in the org:

- No matter what the change, always communicate the need. Writing a detailed why on pull requests is good enough for trivial changes. For non-trivial changes, write a small RFC or some form of `Approach Validation Document` ™ and get a consensus sign off from your team or a subset of the team. This adds a small overhead to delivering your work but in the end your team will thank you for it.

- Treat your codebase not as a junkyard to throw shit in instead a garden to be cultivated. Encourage this mentality within your team as well.

- Hone and cultivate a strong bullshit meter for changes that are done to cover and compensate the deficiencies of the system or the process. Quick hacks to get stuff shipped are okay, living with those hacks without even discussing fixing the problems elsewhere seldom is.

I'd like to end this post with a caveat that there are cases where it's necessary to add quick & dirty hacks to fix production or hustle changes to prod to meet a deadline. Such things are a part and parcel of any engineering org to a certain degree and no one should expect you to write a detailed write up for every single commit you make in these cases. But, recognising the time and place for such changes and balancing that with careful followup is the key to not let the system fall under ever increasing tech debt.
