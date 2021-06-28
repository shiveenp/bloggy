---
title: Equality Checks in Kotlin With Unstructured Data
date: 2021-06-17T21:03:44+10:00
---

This is a small blog post on equality checks in Kotlin when one of the objects may contain arbitrary data.

Let's say you have an object that looks like:

`data class ArbitraryData(val id: UUID, val someData: Map<String, Any>)`

where `someData` is any json map of data that could contain any untyped data at runtime.

Now if you have two instances of this object and try to compare the two using the regular equals method, you would get a false result.

> `arbData1 == arbData2` results in false.

This is due to the default Map equality implementation for Kotlin, basing the check on same references for the objects. Hence, even if you have the `someData` maps in both objects populated with the same value they will fail.

To get around this little dilemma, you need to override the default `equals` implementation for `ArbData` class and manually compare the values.


``` kotlin
data class ArbitraryData(val id: UUID, val someData: Map<String, Any>) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ArbitraryData) return false
        if (id != other.id) return false
        return someData.entries.all { it.value.toString() == other.someData[it.key] }
    }
}
```
