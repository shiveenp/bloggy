---
title: Simple Oembed Service Using Http4k
date: 2019-03-18T11:27:06+11:00
---

Recently on my usual #githunt prowl I came across a new promising http library called [http4k](https://github.com/http4k/http4k/). The library is based on the philosophy of **Application as Function** based on the twitter paper [Your Server as a Function](https://monkey.org/~marius/funsrv.pdf) and promises a lightweight a server toolkit alongwith a very modular approach to adding functionality on top of the core set of capabilities built in. But the best part of all, http4k is written in pure Kotlin and follows a consistent functional approach in handling http services.

Now, as much as a like the kitchen sink approach of Spring framework in getting an almost enterprise ready service running with a couple of tutorials and minimal effort , I really wanted to try my hands at something lighter and different. 

## Setting up a micro server with http4k

Http4k provides a simple yet highly configurable way to setup a microserver using nothing but just the core client and an underlying webserver of choosing. 

To start off, create a new base gradle project in Intellij or any IDE of your choosing and add the following dependencies:

```groovy
dependencies {
    compile "org.jetbrains.kotlin:kotlin-stdlib-jdk8:$kotlin_version"
    compile group: "org.http4k", name: "http4k-core", version: "3.113.0"
    compile group: "org.http4k", name: "http4k-server-netty", version: "3.113.0"
}
```

This will add the base http4k library and the netty server library, which these days is my underlying server of choice when building JVM microservices. However, http4k supports various other server implementation as well such as Jetty, Apache Tomcat etc. and some other prominent jvm web servers.

First thing I tried to do was to experiment setting up a simple http server, this is where http4k is a joy to work with as a library.

Setting up a basic server is fairly simple and requires almost no effort.

```kotlin
fun main() {

    val app = routes(
        "/alive" bind GET to { Response(OK).body("The crew is more kahless now than vogon. biological and tightly dead.") },
        "/api" bind routes(
            "/embedLink" bind GET to { request ->  Response(OK).body(getOembedData(request.query("link")!!))}
        )
    )

    val nettyServer = app.asServer(Netty(9000)).start()
}
```
The snippet above starts up a basic Netty server on port 9000. The startup time is very small, I calculated less than <2 seconds in my observations but the tests were not rigorous so take it with a grain of salt. Once started, the app will start serving the two routes `/alive` and `/api` on the local machine. the alive endpoint is simple to make sure we can ping the app so I;m not going to talk about it anymore. The `/api` link however has an embedded route to `/embedLink` which allows us to make *GET* calls to the server with the query param link which contains the link to the resource we are wanting to get the oembed link for.

So, let's talk a little bit more about how we do that...

## Extracting Oembed data

Now oembed as a protocol is fairly old and many services directly support getting oembed data for the content on their sites using public APIs. One of such sites is [Instagram](https://www.instagram.com/) which has a nice api that properly adheres to oembed standards. Without going to deep into the oembed specification (which if you're keen you can read more about [here](https://oembed.com/#section2)), we'll see how we use the powerful lensing capability of http4k modules to extract oembed data.

The `getOembedData()` function from the routes code snipper in the previous section can be implemented as:

```kotlin
fun getOembedData(link: String): String {
    val request = Request(Method.GET, "https://api.instagram.com/oembed/?url=$link")

    val client: HttpHandler = JavaHttpClient()

    val igLens = Body.auto<IgOembedResponse>().toLens()

    return igLens.extract(client(request)).html
}
```

Here we provide the function an actual link to the resource (in this case a link to a post instagram) and use the hardcoded instagram oembed url to grab the oembed html.  

To actually parse the returned response from instagram, we use a very nifty feature in http4k called [Lenses](https://www.http4k.org/cookbook/typesafe_http_requests_with_lenses/) which allows us to use typesafety while working with the request/response from the http client calls. Lenses are a very powerful feature and allow not only immutable parsing of request/response objects but also use ADTs to parse the responses in an [Maybe](https://en.wikipedia.org/wiki/Monad_(functional_programming)#An_example:_Maybe) using functional extension libraries for kotlin such as [Arrow](https://arrow-kt.io/).

To actually extract the data, we have to define the type of the returned response first and nothing better to do that, than the ever so simple kotlin data classes:

```kotlin
@JsonIgnoreProperties(ignoreUnknown = true)
data class IgOembedResponse(
    val version: String?,
    val title: String?,
    @JsonAlias("author_name")
    val authorName: String?,
    @JsonAlias("author_url")
    val authorUrl: String?,
    @JsonAlias("author_id")
    val authorId: Long?,
    @JsonAlias("media_id")
    val mediaId: String?,
    @JsonAlias("provider_name")
    val providerName: String?,
    @JsonAlias("provider_url")
    val providerUrl: String?,
    val type: String?,
    val width: Int?,
    val height: Int?,
    val html: String,
    @JsonAlias("thumbnail_url")
    val thumbnailUrl: String?,
    @JsonAlias("thumbnail_width")
    val thumbnailWidth: String?,
    @JsonAlias("thumbnail_height")
    val thumbnailHeight: String?
)
```

In this example, I've used the `@JsonIgnoreProperties` and `@JsonAlias` annotations from [jackson](https://github.com/FasterXML/jackson) which is a well known serialization/deserialization library for java. However, http4k does not limit to just one such library and provides various options such as [Gson](https://github.com/google/gson), [moshi](https://github.com/square/moshi) etc. as plugins. Just remember to add the library of your choice in your build.gradle.

Finally, going back to our code snippet for `getOembedData` introduced earlier, we first setup a new client:

```kotlin
val client: HttpHandler = JavaHttpClient()
```

which gives us a new Java based http client, which is a simple implementation of a simple Request -> Response client as a function introduced in the [previous section](## Setting up a micro server with http4k). All it does is take a request and parses the response as a bytestream. 

To parse the bytestream in a typesafe way, we attach it to our lens which contains the data class we just defined:

```kotlin
igLens.extract(client(request))
```

if the request is successful, we will get an object parsed into the `IgOembedResponse` type. For our purposes, what we really need is the html, which gives us the full oembed html which we can use in an iframe.


### Final Notes
In the end, I ended up deploying the app on aws lambda by by setting up an API gateway and a lambda function that called the final app. The final cleaned source code for the app is located [here](https://github.com/shavz/koember) and it also contains the instructions on how to call the aws lambda function to get the oembed responses.

All in all, I was pleasantly surprised at how productive I was working with http4k and how easy it is to set up a FAAS type application using kotlin and AWS.

