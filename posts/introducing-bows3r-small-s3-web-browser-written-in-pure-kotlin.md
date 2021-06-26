---
title: Brows3r - Pure Kotlin S3 Browser
date: 2019-07-29T19:52:50+11:00
---

## Background

Recently I found myself with some extra development time on hand. Now usually, most of my projects start off as big grand ideas and as soon as I start working on them, I lose steam or life comes in the way and things just sit their eating dust as a private github repo.

     
However, I stumbled upon [Kweb](https://github.com/kwebio/kweb-core) which is a server side rendered web app building library, but written entirely in Kotlin. Kweb provides a nice [dsl](https://en.wikipedia.org/wiki/Domain-specific_language) like interface to build web apps by programmatically defining the html elements for the app instead of writing the html and CSS by hand. For those who don't know, Kotlin provides a really nice way to build [type safe declarative builders](https://kotlinlang.org/docs/reference/type-safe-builders.html).
 
 Since it's all created declarative in the kotlin code, we get access coroutines, extensions and all the nice things that make working with Kotlin such a joy. For those of you who have worked with pure code based server side rendered frameworks before, this might remind you of [Vaadin](https://vaadin.com/) which is an industry leader in its space, but there are subtle and not so subtle differences which you can be found on the [Kweb FAQS](http://docs.kweb.io/en/latest/faq.html).

Going through their codebase, I though it would be a really good opportunity to try and a build a quick and easy app by just using pure kotlin. Why you ask? Cause it was quick and I could smash it out in a few hours.

## Simple Kotlin S3 Client

To start off, I wrote a basic S3 browsing class, starting off small - I copied the code from AWS examples on creating a new S3 client and then added the ability to search for all public keys in a given bucket and get some metadata and download links:

```kotlin
class S3Client(private val endpoint: String, private val bucketName: String) {


    private val client = AmazonS3ClientBuilder.standard()
        .withPathStyleAccessEnabled(true)
        .withEndpointConfiguration(AwsClientBuilder.EndpointConfiguration(endpoint, "ap-southeast-2"))
        .build()

    fun listAllKeys(): List<S3Data> {
        val req = ListObjectsV2Request().withBucketName(bucketName).withMaxKeys(10)
        val keyList = mutableListOf<S3Data>()
        client.listObjectsV2(req).objectSummaries.forEach {
            keyList.add(S3Data(it.key, "$endpoint/$bucketName/${it.key}", it.size.toString().toDouble() / 1000.0, it.lastModified.toString()))
        }
        return keyList
    }
}
```

the `listAllKeys()` functions returns a list of all keys in that given bucket, which I can then map to a custom S3Data class:

```kotlin
data class S3Data(
    val key: String,
    val downloadUrl: String,
    val size: Double,
    val lastModifiedAt: String
)
```

## Building the UI with Kweb

Once done, I got cracking on the UI interface. I wanted something quick and simple, crude even, just to demonstrate that it all works as proposed. So I setup a container with some form fields, a search button and a table to input the S3 region link and the name of the bucket. 

I also needed a table to display all the keys (sans pagination, who builds pagination in PoCs anyway? 🤠). To enable holding the data, I used something called [KVAR](https://github.com/kwebio/kweb-core/blob/master/src/main/kotlin/io/kweb/state/KVar.kt) which is simply a state store used by Kweb to support propagating state changes to the web app via [Observer Pattern](https://en.wikipedia.org/wiki/Observer_pattern). 

The following code fragment gets the initialises the S3 data Kvar (setup as an empty list initially) - which eventually propagates it to the table:

```kotlin
div(fomantic.ui.main.container).new {
    div(fomantic.ui.vertical.segment).new {
        div(fomantic.ui.header).text("Welcome to S3 Browser 💻")
    }

    val keyData = KVar(emptyList<S3Data>())

    val loader = div(mapOf("class" to "ui active text loader")).addText("Retrieving keys...")
    loader.setAttribute("class", "ui disabled text loader")
    createInputSegment(loader, keyData)
    createKeysTable(keyData)
}
```

Now, here is where Kwebs deep integration with kotlin really comes in handy, since it allows us to use [kotlin coroutines](https://kotlinlang.org/docs/reference/coroutines-overview.html) to handle tasks with considerable i/o (such as retrieving data from an AWS bucket). I have recently started using coroutines frequently in production code and I can without doubt say they're the best way to write asynchronous tasks without worrying about threads. The low touch syntax setup and the results are so easy it almost feels like cheating.

The following code fragment uses the `S3Client` introduced earlier to launch a coroutine and when the user hits the search button, and displays a loading icon until all the data is retrieved or an error is thrown:

```kotlin
private fun ElementCreator<DivElement>.createInputSegment(
    loader: Element,
    keyData: KVar<List<S3Data>>
) {
    div(fomantic.ui.vertical.segment).new {
        div(fomantic.ui.input).new {
            val endpointInput = input(type = InputType.text, placeholder = "Enter S3 Endpoint Url")
            val bucketInput = input(type = InputType.text, placeholder = "Enter S3 Bucket Name")
            button(mapOf("class" to "ui primary button")).text("Search").on.click {
                GlobalScope.launch {
                    loader.setAttribute("class", "ui active text loader")
                    val s3Client =
                        S3Client(endpointInput.getValue().await(), bucketInput.getValue().await())
                    try {
                        keyData.value = s3Client.listAllKeys()
                    } catch (ex: Exception) {
                        p().execute(ERROR_TOAST)
                        loader.setAttribute("class", "ui disabled text loader")
                    }
                    if (keyData.value.isNotEmpty()) {
                        p().execute(SUCCESS_TOAST)
                        loader.setAttribute("class", "ui disabled text loader")
                    }
                }
            }
        }
    }
}
```

So far so good, now that we have successfully pulled in the data in out Kvar container, we can start rendering a table. Now I also wanted to show a nice little icon to show that the retrieved object was a file - and also allow the ability to click name of the key as a link so the user can download.

Now Kweb as far as I could tell didn't have the ability to specify that via a DSL object, however, it does provide the ability to specify nested HTML inside a table element to add my own custom behaviour. 

```kotlin
private fun ElementCreator<DivElement>.createKeysTable(
    keyData: KVar<List<S3Data>>
) {
    table(mapOf("class" to "ui celled striped table")).new {
        thead().new {
            tr().new {
                th().text("Key")
                th().text("File Size (in KB)")
                th().text("Last Modified At")
            }
        }
        tbody().new {
            keyData.map {
                it.forEach {
                    tr().new {
                        td(mapOf("data-lable" to "Key")).innerHTML("<i class=\"file outline icon\"></i> <a target=\"_blank\" href=${it.downloadUrl} download=${it.key}>${it.key}</a>")
                        td(mapOf("data-lable" to "File Size")).text("${it.size} KB")
                        td(mapOf("data-lable" to "Last Modified At")).text(it.lastModifiedAt)

                    }
                }
            }
        }
    }
}
```

The code above creates a new table and generates a new row in the table for each public key present in the provided bucket. If no data is present, nothing gets rendered. 

This probably also the time to give a shoutout to the Kweb creators for an integration with [Fomantic UI](https://fomantic-ui.com/) which comes pre-configured with nice UI elements. Although, the integration doesn't end there and there is a nice APi for anyone to write a new plugin with their favourite UI elements library. 

## Final Notes

And that is all that's needed to write a simple S3 browsing web app using Kweb. [Here](https://secure-scrubland-34237.herokuapp.com/) is the app deployed on heroku and the full working code is on [github](https://github.com/shavz/Bows3r). 

Gif Demo:
                                                                                
![](https://imgur.com/YoJdUxj.gif)

Youtube Demo:

<iframe width="560" height="315" src="https://www.youtube.com/embed/0soMtA2vUSo" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
