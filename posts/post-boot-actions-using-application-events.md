---
title: Post Boot Actions Using Application Events
date: 2019-01-10T18:23:18+11:00
---

## Background

Recently I faced an interesting problem at work. A production app written in Kotlin with Spring Webflux as the webframework had suddenly started taking more than 189 seconds on average to start (more than 3 minutes 😱).

Now as much as I love spring for the easy to use and battle tested APIs, everyone knows its not the nimblest of frameworks around, but having a boot time of 3 minutes was simply unacceptable. The problem was made even worse by the fact that our production kubernetes cluster, on which the app was deployed, usually checks if the app is alive (a simple alive endpoint on the REST api) and triggers container restart if the app doesn't respond withing a given time threshold. Due the delay in the app boot, the kubernetes kept on assuming the app has not started yet and it triggered a flurry of container restarts - resulting in our very talented and very hard working support team being pinged at ungodly hours. Something needed to be done...

After spending some time analyzing the application, we found that most of the time was being spent in the startup for [Elastic Search Transport client](https://www.elastic.co/guide/en/elasticsearch/client/java-api/current/transport-client.html), which loads up several plugins, one of which is the `Transport Client` which relies on the negotiating underlying netty thread which also happens to be the same underlying server that spring webflux uses.

To test the theory that this was the reason the build was slowing down, we commented out the code that builds up the client and noticed that the app was starting in less than 10 seconds now! WOAH! that's a big gain...

## Setting up post bootup logic

[Spring](https://spring.io/) always has had events inside the system since the very beginning as a loose way to exchange application context information inside a running spring app and there are variety uses, most frequently being the ability to detect any local or global event change and then associating actions or events that take place post the event taking place.

To solve out problem, we created a class called event listener where all the startup logic was shifted (the code is in [Kotlin](https://kotlinlang.org/)):

```kotlin
class EventListener {

    private fun expensiveThings() {
//        do expensive intialization steps here
    }

    @EventListener(ApplicationReadyEvent::class)
    fun bootStrap() {
        expensiveThings()
    }
}
```

The code above is very simple, it sets up a class called event listener which will contain all our spring application event listener logic. We have a function named `expensiveThings()` , which does something that involves heavy initialization (think network negotiation, I/O bound work etc.) steps and something we want to do pot application startup. Ideal candidates for this scenario might be plugins or utilities that let you interact with third party services like elastic search but that are not absolutely necessary to have when your app is first starting to serve it's controller endpoints. Inside `expensiveThings()` we can add something with heavy init. Function `bootStrap()` is where all the magic takes place. We use the spring [EventListener](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/context/event/EventListener.html) which gives us the ability to link any `void` returning function to an application event, in other words, at runtime spring will proxy the call for that event to be triggered when the registered event is received inside the springboot application context. In our case that is the springs **ApplicationReadyEvent** which gets sent out the first time a spring boot application fully starts up.

But our job is not done yet, we would like a way to access the initialized variable throughout our application, and we would like to do it in as idiomatic spring way as possible.

To achieve that we will modify our previous code as follows:

```kotlin
@Configuration
class EventListener {

    lateinit var poststartupVar: String

    private fun expensiveThings() {
        poststartupVar = "this is just an example"
    }

    @EventListener(ApplicationReadyEvent::class)
    fun bootStrap() {
        expensiveThings()
    }
}
```

here we've modified the class to include a `lateinit` (if you don't know, a [lateinit](https://kotlinlang.org/docs/reference/properties.html#late-initialized-properties-and-variables) variable in kotlin is simply a variable that doesn't need to be initialized at declaration, this makes the code cleaner but you run the risk of an ugly exception if the variable is still initialized at the time of accessing); which then gets instantiated in expensive things. We've also marked the class as a configuration object, which makes it a candidate for injection autowring througghout your spring managed beans like Components, Services etc.

This should get you up an running with a variable that gets initialized post the ApplicationReadyEvent which, if your application has REST controllers, happens post the app starting to listen on those endpoints.

However, what if this component is a core component and we want to hard exit as soon as possible. 

No problem, as demonstrated below:

```kotlin
@Configuration
class EventListener: ApplicationContextAware {

    lateinit var poststartupVar: String

    private var context: ApplicationContext? = null

    private fun expensiveThings() {
        poststartupVar = "this is just an example"
    }

    @EventListener(ApplicationReadyEvent::class)
    fun bootStrap() {
        try {
            expensiveThings()
        } catch (ex: Exception) {
            panic()
        }
    }

    private fun panic() {
        val containerContext = this.context as ConfigurableApplicationContext
        SpringApplication.exit(containerContext)
    }
}
```

Here we use the help of [ApplicationContext](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/context/ApplicationContext.html) to inject the current running springboot application context in the even listener configuration (more details [here](https://spring.io/understanding/application-context)). In case an exception is encountered in the `bootStrap()`, the `panic()` function will be invoked and the spring application will be gracefully exited (the graceful bit depends on your configuration but that's for another blogpost).

## Final notes
A code very similar to that with some business speicifc sauce is what I used to solve the problem we encountered in the previous section and it brought down the application startup time to less than 15 seconds, which was a major win for a critical production application. Utilizing the APIs and utilities provided by Spring out of the box in my opinion provides the easiest and most convenient way to solve most production problems and is a testament to maturity of Spring and its status as one of the top jvm web framework out there.
