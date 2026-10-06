plugins {
    id("com.android.application")
}

android {
    namespace = "com.bosguega.memoriaauxiliar"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.bosguega.memoriaauxiliar"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// AGP 9 compila Kotlin nativamente (built-in Kotlin); este bloco configura o
// compilador embutido, sem o plugin org.jetbrains.kotlin.android separado.
kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}