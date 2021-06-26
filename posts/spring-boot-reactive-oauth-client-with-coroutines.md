---
title: Building a Reactive Oauth Client App with SpringBoot and Kotlin Coroutines
date: 2020-06-09T20:40:49+10:00
---

{{< figure src="/spring-boot-coroutines-oauth.jpg" alt="image" caption="Photo by Buzz Andersen on Unsplash" class=big" >}}

## Background
In this post, I’ll walk through two new exciting things that have happened in the spring ecosystem recently. First is spring webflux support for kotlin [couroutines](https://kotlinlang.org/docs/reference/coroutines-overview.html) and second is the overhaul of spring security, and the addition of the out of the box oauth2 client support for [social logins](https://spring.io/blog/2018/07/03/spring-social-end-of-life-announcement).

For me one of the most impactful new features is the integration with spring coroutines throw the [Flow](https://kotlin.github.io/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-flow/index.html) primitive. The integration makes writing reactive code a lot more straightforward - no more `subscribeOn` and `observeOn` operations. Instead of thinking in terms of `Mono` and `Flux` based primitives borrowed from [reactor](https://github.com/reactor/reactor-core), it allows a straightforward way to generate cold streams instead. Kotlin flow allows us to write purely asynchronous code in an sequential/imperative manner - which in turn means an existing codebase using blocking code can be converted to use the non-reactive paradigm a lot easier. Another advantage of using coroutines based non-blocking code is that coroutines have been implemented as [lightweight threads](https://medium.com/@elizarov/blocking-threads-suspending-coroutines-d33e11bf4761) whereas schedulers with reactor can incur a lot of performance overhead as they have to context switch between threads. As we progress forward in this post, people who are already familiar with composing non-reactive code in webflux will see what I mean. 

## Let's get started!
To demonstrate the way this works, we will try to develop an asynchronous api that connects to a GitHub account and gets all the starred repos for a user. The api will use spring webflux with Kotlin Flow and we will integrate that with the spring oauth2 client to ensure the user is logged in.

To start off, let’s create a new gradle project in whatever IDE you prefer (I use Intellij IDEA) and add the following set of dependencies:

```shell script
implementation("org.springframework.boot:spring-boot-starter-webflux")
implementation("org.springframework.boot:spring-boot-starter-security")
implementation("org.springframework.security:spring-security-oauth2-client")
implementation("org.springframework.security:spring-security-oauth2-jose")
implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
implementation("io.projectreactor.kotlin:reactor-kotlin-extensions")
implementation("org.jetbrains.kotlin:kotlin-reflect")
implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk8")
implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core")
implementation("org.jetbrains.kotlinx:kotlinx-coroutines-reactor")
```

Once setup, lets start building our controller first, creating a new file `Router.kt`

```kotlin
@RestController
class Router {

    @Bean
    fun routes(handler: Handler) = coRouter {
        "/".nest {
            GET("", handler::getStarredRepos)
        }
    }
}
```

As you can see we have simply used the normal way of defining a new spring based REST api controller but instead of using the standard router annotations we took the approach of using the coRouter. It’s more of a personal preference since it allows me to see my whole api surface area in a more concise format. However, you could easily replace it with the more common Spring MVC style annotation based approach.

Next we will build a handler that let’s us handle our service response.

```kotlin
@Component
class Handler(val service: Service) {

    suspend fun getStarredRepos(req: ServerRequest): ServerResponse {

        return ok().bodyAndAwait(service.getUserStarredRepos())
    }
}
```
Nothing special about the handler except two main distinctions when compared to equivalent reactor based approach. First is that we have made the function `getStarredRepos()` a suspending function - which means it tells the compiler that this code will be run inside a couroutines context. The second interesting thing to note is theat we used a `bodyAndAwait()` instead of `body()` method for a server response. This extension allows us to correctly get the body from suspending couroutine context while the service is generating a response without blocking the calling thread.

Now let’s jump into the service code - we will use the new spring Oauth2 client with comes with first class webflux support to make our app support the GitHub Oauth login.

To begin with, [register a new app in Github](https://github.com/spring-projects/spring-security/tree/5.3.3.RELEASE/samples/boot/oauth2login#github-register-application). Once done, add a new `application.yml` file and add your oauth details like:

```yaml
spring:
  security:
    oauth2:
      client:
        registration:
          github:
            clientId: <add-github-client-id-here>
            clientSecret: <add-github-client-secret-here>
```

This tells the Oauth client what credentials to use when redirecting a non authenticated user to Github authentication page. The default authorization callback url setup by the spring is: `http://localhost:8080/login/oauth2/code/github` .In and of itself all oauth client will do is grab the github authorization grant and store that data in a `JSESSION` cookie. If that's all you want to do then that's fine - however, I would also like to show the user their starred github repositories. To achieve that we need to be able to somehow get the access token and make an authenticated call on behalf of the user. Spring provides a nice and secure interface to achieve that as well - enter the authenticated webclient.

Webclient is the reactive counterpart of the old and trusty RestTemplate from the Spring MVC days introduced in Spring webflux. It allows us to make calls to APIs in a non-blocking api and comes with nice composition and testing support. In our case, we will build a spring config that will populate the current context with an authenticated webclient for the current logged in user.

```kotlin
@Configuration
class GithubWebClientConfig {

    @Bean
    fun webClient(clientRegistrations: ReactiveClientRegistrationRepository?,
                  authorizedClients: ServerOAuth2AuthorizedClientRepository?): WebClient? {
        val oauth = ServerOAuth2AuthorizedClientExchangeFilterFunction(clientRegistrations, authorizedClients)
        oauth.setDefaultOAuth2AuthorizedClient(true)
        return WebClient.builder()
            .filter(oauth)
            .build()
    }
}
```

The key to setting the right authentication credentials is the line `oauth.setDefaultOAuth2AuthorizedClient(true)` which allows the github client bean to be automatically authenticated with the current users github tokens, simple and delightful.

Now we'll go ahead and wire up the last piece of this puzzle which is the service layer that allows us to tie the authenticated webclient with an API call. So let's go ahead and do that:

```kotlin
@Service
class Service(val client: WebClient) {

    suspend fun getUserStarredRepos(): Flow<String> {
        return client
            .get()
            .uri("https://api.github.com/user/starred?page=1")
            .retrieve()
            .bodyToFlow()
    }
}
```

 To explain a bit of what's going in this code snippet, we have created another suspendable function `getUserStaarredRepos()` that retrieves the starred repos from github and uses our pre authenticated oauth webclient to do so. One callout here would be the return type which is of the type `Flow<String>` . This possible due to Kotlins extension based programming approach where the coroutines team have created an extension for the webclient which is functionally equal to reactor's `bodyToFlux()` method.

That concludes our build for this app. To test, let's fire it up using the ever helpful gradle `bootRun` command (you should run this in your terminal with the current directory set to this sample project root):

```shell script
./gradlew bootRun
```

Once done, this will start up our Springboot app and you should be able to navigate to [localhost:8080](http://localhost:8080) to see it in action.

### Comparing with non-reactive flow

Thanks to [clojj](https://github.com/clojj) the example project for this post has been updated. It now supports demonstrating how the HTTP responses work for Flow type vs sending a normal response. To demonstrate, we now have two endpoints that return the same data as the endpoint described originally in this post but have been segregated into a non-blocking vs blocking function. Our `Router.kt` file now looks like:

```kotlin
@RestController
class Router {

    @Bean
    fun routes(handler: Handler) = coRouter {
        "/".nest {
            GET("flow", handler::getStarredReposAsFlow)
            GET("list", handler::getStarredReposAsList)
        }
    }
}
```
where we now have a `getStarredReposAsList` endpoint to demonstrate sending the data as List. Consequently, the handler and service now look like,

`Handler.kt`
```kotlin
@Component
class Handler(val service: Service) {

    suspend fun getStarredReposAsFlow(req: ServerRequest): ServerResponse {
        val starredRepos = service.getUserStarredReposAsFlow()
        return ok().bodyAndAwait(starredRepos)
    }

    suspend fun getStarredReposAsList(req: ServerRequest): ServerResponse {
        val starredRepos = service.getUserStarredReposAsList()
        return ok().bodyValueAndAwait(starredRepos)
    }
}
```

`Service.kt`
```kotlin
@Service
class Service(val client: WebClient) {

    suspend fun getUserStarredReposAsFlow(): Flow<Repository> {
        return client
            .get()
            .uri("https://api.github.com/user/starred?page=1")
            .retrieve()
            .bodyToFlow()
    }

    suspend fun getUserStarredReposAsList(): List<Repository> {
        return client
            .get()
            .uri("https://api.github.com/user/starred?page=1")
            .retrieve()
            .awaitBody()
    }
}
```

To illustrate our point, lets fire the app again and check the responses sent by these two endpoints.


{{< figure src="/spring-boot-oauth-kotlin-flow-chunked-response.png" alt="image" caption="Response when hitting the flow endpoint (contains transfer-encoding header)" >}}


{{< figure src="/spring-boot-oauth-kotlin-list-non-chunked-response.png" alt="image" caption="Response when hitting the list endpoint (contains the full content-length header)" >}}


As expected, the Flow based non-blocking endpoint does not know what the full size of the response will be so it adds the `transfer-encoding: chunked` header. On the other hand, the blocking type endpoint which returns a list directly knows the response size beforehand, so it adds the `Content-Length` header letting the client know the size of the payload being received straightaway.

Depending on the specs of your application and how you want the browser to behave it is probably worthwhile understanding which of these two http responses suit your usecase.

## Conclusion

As someone who moved from springboot with spring mvc building blocking code to using spring webflux and spending hours to understand the non-blocking paradigm - the Flow support in webflux is a welcome evolution. The potential of migrating existing codebases to non-blocking stream based paradigm has been greatly amplified, and I can already see the impact it is having in making my own side projects a lot easier to build and reason about! 

If you'd like to experiment yourself the source code for this post can be found on [github](https://github.com/shavz/spring-reactive-kotlin-oauth2-github-example).

---

### References:
1. https://medium.com/better-programming/asynchronous-data-loading-with-new-kotlin-flow-233f85ae1d8b
2. https://spring.io/blog/2019/04/12/going-reactive-with-spring-coroutines-and-kotlin-flow
3. https://medium.com/@elizarov/execution-context-of-kotlin-flows-b8c151c9309b
4. https://todd.ginsberg.com/post/springboot-reactive-kotlin-coroutines/
5. https://spring.io/guides/tutorials/spring-boot-oauth2/
6. https://spring.io/guides/tutorials/spring-boot-oauth2/#github-register-application
7. https://www.httpwatch.com/httpgallery/chunked/
