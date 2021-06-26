---
title: Right Way To Shadow Jar When Using Jetty With Http4k
date: 2020-04-18T13:10:59+10:00
---

If you’ve been spring boot for a while, you’re probably familiar with Spring’s bootJar functionality that lets you create a new executable “fat jar” with all its dependencies pre defined. However, while I was building a kotlin app using http4k, which doesn’t come with any such built in tooling I had to resort to using the shadowJar plugin to build a fat jar.

However post deploy, the app stopped starting up and I noticed the following error in the logs:

```bash
Exception in thread “main” java.lang.ExceptionInInitializerError
	at org.eclipse.jetty.http.MimeTypes$Type.<init>(MimeTypes.java:98)
	at org.eclipse.jetty.http.MimeTypes$Type.<clinit>(MimeTypes.java:56)
	at org.eclipse.jetty.http.MimeTypes.<clinit>(MimeTypes.java:175)
	at org.eclipse.jetty.server.handler.ContextHandler.doStart(ContextHandler.java:806)
	at org.eclipse.jetty.servlet.ServletContextHandler.doStart(ServletContextHandler.java:275)
	at org.eclipse.jetty.util.component.AbstractLifeCycle.start(AbstractLifeCycle.java:72)
	at org.eclipse.jetty.util.component.ContainerLifeCycle.start(ContainerLifeCycle.java:169)
	at org.eclipse.jetty.util.component.ContainerLifeCycle.doStart(ContainerLifeCycle.java:110)
	at org.eclipse.jetty.server.handler.AbstractHandler.doStart(AbstractHandler.java:100)
	at org.eclipse.jetty.websocket.server.WebSocketHandler.doStart(WebSocketHandler.java:84)
	at org.eclipse.jetty.util.component.AbstractLifeCycle.start(AbstractLifeCycle.java:72)
	at org.eclipse.jetty.util.component.ContainerLifeCycle.start(ContainerLifeCycle.java:169)
	at org.eclipse.jetty.server.Server.start(Server.java:407)
	at org.eclipse.jetty.util.component.ContainerLifeCycle.doStart(ContainerLifeCycle.java:110)
	at org.eclipse.jetty.server.handler.AbstractHandler.doStart(AbstractHandler.java:100)
	at org.eclipse.jetty.server.Server.doStart(Server.java:371)
	at org.eclipse.jetty.util.component.AbstractLifeCycle.start(AbstractLifeCycle.java:72)
	at org.http4k.server.Jetty$toServer$3.start(jetty.kt:33)
	at io.taggit.AppKt.main(App.kt:175)
	at io.taggit.AppKt.main(App.kt)
Caused by: java.lang.ArrayIndexOutOfBoundsException: 1
	at org.eclipse.jetty.http.PreEncodedHttpField.<clinit>(PreEncodedHttpField.java:68)
	… 20 more
```

Perplexed, since when I used the same plugin with another one of my projects I had never noticed this error. 

After much googling, turns out Jetty bundles HttpField encoders by referencing `META-INF/services/org.eclipse.jetty.http.HttpFieldPreEncoder` so when shadow jar created the fat jar it didn’t have the data that Jetty was looking for which in turn meant Jetty threw an initialisation exception.

The fix?

Adding the `mergeServiceFiles()` attribute to the shadowJar task, as per the shadow documentation [here](https://imperceptiblethoughts.com/shadow/configuration/merging/#merging-service-descriptor-files).

```groovy
shadowJar {
    baseName = ‘taggit-api’
    zip64 = true
    mergeServiceFiles()
}
```

And voila, the service was back up and running again. This is becauase multiple libraries potentially use the same service descriptor files (usually `META-INF`) and in case of creating fat jars its generally desired to merge the service descriptors to make sure all libraries have their service descriptors loaded at runtime.

P.S. - It might be worth mentioning here as well that the reason I didn’t encounter the same error for one of my other services is due to that project using Netty as the underlying webserver.
