---
title: Test Multipart/Form Data with WebTestClient
date: 2019-04-21T16:52:55+11:00
---

## Background

For the past year or so, I have been working extensively with spring, especially spring webflux; building scalable reactive micro services for our customers.

Coming from spring MVC, learning webflux and getting used to reactive programming in general has been a great and worthy learning experience and I highly suggest going through the [references](#References) section if you haven’t heard of reactive programming and/or have been thinking about giving it a go and don’t know where to start. But essentially reactive programming involves a model of creating, requesting and manipulating data in a controllable (from a consumers perspective) and non-blocking manner.

[WebTestClient](https://docs.spring.io/spring/docs/current/spring-framework-reference/testing.html#webtestclient) is a reactive testing high level http client with fluent assertions, packaged in spring web flux. Recently, while integration testing an application that accepted data as [multipart/form-data](https://tools.ietf.org/html/rfc7578) I had to figure out how to test the data effectively using the webtestclient and personally found the lack of comprehensive resources on the internet lacking, so I wrote this blogpost to share my own learnings.

## Web Form Testing with Webflux

Let’s suppose that we’re trying to send the request to fill a form api that accepts a document (image, text, plain binary etc.) and some textual data.

To aid with our example, lets imagine the form is a profile setup for an document share service and takes the following input:

- Profile Image (_api label: profileImage_)
- Username (_api label: username_)
- Email (_api label: email_)
- PDF document to share (_api label: userDocument_)

For us to begin sending the data, we’ll use the spring library called [MultipartBodyBuilder](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/http/client/MultipartBodyBuilder.html) which provides a nice api for setting up the body for multipart requests.

To send the first part, the profile image we can set it up as:

```kotlin
val bodyBuilder = MultipartBodyBuilder()

bodyBuilder.part("profileImage", ClassPathResource("test-image.jpg").file.readBytes()).header("Content-Disposition", "form-data; name=profileImage; filename=profile-image.jpg")
```

To explain a bit about what’s going on there, we’re simply telling the body builder to upload an image found in `src/test/resources` folder with the name `test-image.jpg` as the profile image part of this body. The real kicker here is setting up the **Header** part as that is what’s used by the webtestclient internals (specifically the [Synchronoss-nio](https://github.com/synchronoss/nio-multipart) library which webflux uses internally) to determine the type of form data being sent and how to process it.

Also, note that the real file name that will get uploaded in the web server receiving the request is the `profile-image.jpg` filename that gets sent as part of the headers,.

Similar to the profile image, we can also send the document part of the whole request payload:

```kotlin
bodyBuilder.part("userDocument", ClassPathResource("user-document.pdf").file.readBytes()).header("Content-Disposition", "form-data; name=userDocument; filename=my-thesis.pdf")
```

Similar to the previous payload we test the body builder  💪 to read a file in the test resources folder called `user-document.pdf`  as bytes and send the document with the name `my-thesis.pdf` to the form web api. 

As you can already see, compared to some other ways of doing it, such as in this [excellent blog](https://www.baeldung.com/spring-rest-template-multipart-upload) , using the MultipartBodyBuilder is rather conveneient. 

Now for the last two remaining pieces of the form api, which are usually only plain text, we can set them up as:

```kotlin
bodyBuilder.part("username", "shiveenpandita", MediaType.TEXT_PLAIN).header("Content-Disposition", "form-data; name=username").header("Content-type", "text/plain")

bodyBuilder.part("email", "shiveenpandita@gmail.com", MediaType.TEXT_PLAIN).header("Content-Disposition", "form-data; name=email").header("Content-type", "text/plain")
```

Woohoo! 🎉 We’ve got all our form fields wired now.

Now to see it all in action and bring it all together, we can simply setup a spring integration test and use our freshly setup body builder as:


```kotlin
@RunWith(SpringRunner::class.java)
@SpringBootTest
@AutoConfigureWebTestClient
class WebClientTest {

    private lateinit var webclient: WebTestClient

    @Test
    fun `test webform api`() {
        val bodyBuilder = MultipartBodyBuilder()

        bodyBuilder.part("profileImage", ClassPathResource("test-image.jpg").file.readBytes()).header("Content-Disposition", "form-data; name=profileImage; filename=profile-image.jpg")

        bodyBuilder.part("userDocument", ClassPathResource("test-document.pdf").file.readBytes()).header("Content-Disposition", "form-data; name=userDocument; filename=my-thesis.pdf")

        bodyBuilder.part("username", "shiveenpandita", MediaType.TEXT_PLAIN).header("Content-Disposition", "form-data; name=username").header("Content-type", "text/plain")

        bodyBuilder.part("email", "shiveenpandita@gmail.com", MediaType.TEXT_PLAIN).header("Content-Disposition", "form-data; name=email").header("Content-type", "text/plain")

        webClient.post()
            .uri("/v1/test-api")
            .contentType(MediaType.MULTIPART_FORM_DATA)
            .body(BodyInserters.fromMultipartData(bodyBuilder.build()))
            .exchange()
            .expectStatus().isOk
    }
}
```

The above code snippet will successfully send the required data to our test api and the webtestclient asserts that the response is 200 OK.

![](https://media.giphy.com/media/l0ErKDci4GgPkcAF2/giphy.gif)

## References

- [Reactive Manifesto](https://www.reactivemanifesto.org/)
- [Spring Webflux](https://docs.spring.io/spring/docs/current/spring-framework-reference/web-reactive.html#spring-webflux)
- [Awesome-List](https://github.com/lucamezzalira/awesome-reactive-programming)
