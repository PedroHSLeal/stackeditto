Each year, summer arrives to find me daunted and excited to write about the performance improvements in the upcoming release of .NET. “Daunted,” because these posts, covering [.NET 8](https://devblogs.microsoft.com/dotnet/performance-improvements-in-net-8/), [.NET 7](https://devblogs.microsoft.com/dotnet/performance_improvements_in_net_7/), [.NET 6](https://devblogs.microsoft.com/dotnet/performance-improvements-in-net-6), [.NET 5](https://devblogs.microsoft.com/dotnet/performance-improvements-in-net-5), [.NET Core 3.0](https://devblogs.microsoft.com/dotnet/performance-improvements-in-net-core-3-0), [.NET Core 2.1](https://devblogs.microsoft.com/dotnet/performance-improvements-in-net-core-2-1), and [.NET Core 2.0](https://devblogs.microsoft.com/dotnet/performance-improvements-in-net-core), have garnered a bit of a reputation I want to ensure the next iteration lives up to. And “excited,” because there’s such an abundance of material to cover due to just how much goodness has been packed into the next .NET release, I struggle to get it all written down as quickly as my thoughts whirl.

And so, every year, I start these posts talking about how the next release of .NET is the fastest and best release to date. That’s true for .NET 9 as well, of course, but the statement that .NET 9 is the fastest and best release of .NET to date is now a bit… mundane. So, let’s spice it up a bit. How about… a haiku?

    As the falcon flies,
    .NET 9 speeds joy into
    Developers' hearts.

Or, maybe a limerick:

    In the coding world, there's a star,
    .NET 9, the best by far.
    With speed that's supreme,
    It's every coder's dream,
    Taking development to a new par.

A little gimmicky? Maybe something more classical, a sonnet perhaps:

    In realms of code where brilliance finds its way,
    .NET 9 shines with an unmatched array.
    Its speed and grace, a marvel to behold,
    Transforming tasks to treasures, fast and bold.
    
    Developers, with joy, embrace its might,
    Their projects soar, efficiency in sight.
    No longer bound by limits of the past,
    In .NET 9, their dreams are built to last.
    
    Its libs, a symphony of pure delight,
    Turning complex to simple, dim to light.
    With every line of code, a masterpiece,
    In .NET 9, dev burdens find release.
    
    Oh, wondrous .NET 9, you light the way,
    In your embrace, our future's bright as day.

Ok, so, yeah, I should stick to writing software rather than poetry (something with which my college poetry professor likely agreed). Nevertheless, the sentiment remains: .NET 9 is an incredibly exciting release. More than 7,500 pull requests (PRs) have merged into [dotnet/runtime](https://github.com/dotnet/runtime) in the last year, of which a significant percentage have touched on performance in one way, shape, or form. In this post, we’ll take a tour through over 350 PRs that have all found their way into packing .NET 9 full of performance yumminess. Please grab a large cup of your favorite hot beverage, sit back, settle in, and enjoy.

Benchmarking Setup
------------------

In this post, I’ve included micro-benchmarks to showcase various performance improvements. Most of these benchmarks are implemented using [BenchmarkDotNet](https://github.com/dotnet/benchmarkdotnet) [v0.14.0](https://www.nuget.org/packages/BenchmarkDotNet/0.14.0), and, unless otherwise noted, there is a simple setup for each.

To follow along, first make sure you have [.NET 8](https://dotnet.microsoft.com/download/dotnet/8.0) and [.NET 9](https://dotnet.microsoft.com/download/dotnet/9.0) installed. The numbers I share were gathered using the .NET 9 Release Candidate.

Once you have the appropriate prerequisites installed, create a new C# project in a new benchmarks directory:

    dotnet new console -o benchmarks
    cd benchmarks

The resulting directory will contain two files: `benchmarks.csproj`, which is the project file with information about how the application should be compiled, and `Program.cs`, which contains the code for the application. Replace the entire contents of `benchmarks.csproj` with this:

    <Project Sdk="Microsoft.NET.Sdk">
    
      <PropertyGroup>
        <OutputType>Exe</OutputType>
        <TargetFrameworks>net9.0;net8.0</TargetFrameworks>
        <LangVersion>Preview</LangVersion>
        <ImplicitUsings>enable</ImplicitUsings>
        <Nullable>enable</Nullable>
        <AllowUnsafeBlocks>true</AllowUnsafeBlocks>
        <ServerGarbageCollection>true</ServerGarbageCollection>
      </PropertyGroup>
    
      <ItemGroup>
        <PackageReference Include="BenchmarkDotNet" Version="0.14.0" />
      </ItemGroup>
    
    </Project>

The preceding project file tells the build system we want:

*   to build a runnable application, as opposed to a library.
*   to be able to run on both .NET 8 and .NET 9, so that BenchmarkDotNet can build multiple versions of the application, one to run on each version, in order to compare the results.
*   to be able to use all of the latest features from the C# language even though C# 13 hasn’t officially shipped yet.
*   to automatically import common namespaces.
*   to be able to use nullable reference type annotations in the code.
*   to be able to use the `unsafe` keyword in the code.
*   to configure the garbage collector (GC) into its “server” configuration, which impacts the trade-offs it makes between memory consumption and throughput. This isn’t required, but it’s how most services are configured.
*   to pull in `BenchmarkDotNet` v0.14.0 from NuGet so that we’re able to use the library in `Program.cs`.

For each benchmark, I’ve then included the full `Program.cs` source; to test it, just replace the entire contents of your `Program.cs` with the shown benchmark. Each test may be configured slightly differently from others, in order to highlight the key aspects being shown. For example, some tests include the `[MemoryDiagnoser(false)]` attribute, which tells BenchmarkDotNet to track allocation-related metrics, or the `[DisassemblyDiagnoser]` attribute, which tells BenchmarkDotNet to find and share the assembly code for the test, or the `[HideColumns]` attribute, which removes some output columns that BenchmarkDotNet might otherwise emit but that are unnecessary clutter for our needs in this post.

Running the benchmarks is then simple. Each test includes a comment at its top for the `dotnet` command to use to run the benchmark. It’s typically something like this:

    dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0

That:

*   builds the benchmarks in a Release build. Compiling for Release is important as both the C# compiler and the JIT compiler have optimizations that are disabled for Debug. Thankfully, BenchmarkDotNet warns if Debug is accidentally used:
    
        // Validating benchmarks:
        //    * Assembly Benchmarks which defines benchmarks is non-optimized
        Benchmark was built without optimization enabled (most probably a DEBUG configuration). Please, build it in RELEASE.
        If you want to debug the benchmarks, please see https://benchmarkdotnet.org/articles/guides/troubleshooting.html#debugging-benchmarks.
    
*   targets .NET 8 for the host project. There are multiple builds involved here: the “host” application you run with the above command, which uses BenchmarkDotNet, which will in turn generate and build an application per target runtime. Because the code for the benchmark is compiled into all of these, you typically want the host project to target the oldest runtime you’ll be testing, so that building the host application will fail if you try to use an API that’s not available in all of the target runtimes.
*   runs all of the benchmarks in the whole program. If you don’t specify the `--filter` argument, BenchmarkDotNet will prompt you to ask which benchmarks to run. By specifying “\*”, we’re saying “don’t prompt, just run ’em all.” You can also specify an expression to filter down which subset of the tests you want invoked.
*   runs the tests on both .NET 8 and .NET 9.

Throughout the post, I’ve shown many benchmarks and the results I received from running them. Unless otherwise stated (e.g. because I’m demonstrating an OS-specific improvement), the results shown for benchmarks are from running them on Linux (Ubuntu 22.04) on an x64 processor.

    BenchmarkDotNet v0.14.0, Ubuntu 22.04.3 LTS (Jammy Jellyfish) WSL
    11th Gen Intel Core i9-11950H 2.60GHz, 1 CPU, 16 logical and 8 physical cores
    .NET SDK 9.0.100-rc.1.24452.12
      [Host]     : .NET 9.0.0 (9.0.24.43107), X64 RyuJIT AVX-512F+CD+BW+DQ+VL+VBMI

My standard caveat: these are micro-benchmarks, often measuring operations that take very short periods of time, but where improvements to those times add up to be impactful when executed over and over and over. Different hardware, different operating systems, what other processes might be running on your machine, who you had breakfast with this morning, and the alignment of the planets can all impact the numbers you get out. In short, the numbers you see are unlikely to match exactly the numbers I share here; however, I’ve chosen benchmarks that should be broadly repeatable.

With all that out of the way, let’s do this!

JIT
---

Improvements in .NET show up at all levels of the stack. Some changes result in large improvements in one specific area. Other changes result in small improvements across many things. When it comes to broad-reaching impact, there are few areas of .NET that result in changes more broadly-impactful than those changes made to the Just In Time (JIT) compiler. Code generation improvements help make everything better, and it’s where we’ll start our journey.

### PGO

In [Performance Improvements in .NET 8](https://devblogs.microsoft.com/dotnet/performance-improvements-in-net-8/), I called out the enabling of dynamic profile guided optimization (PGO) as my favorite feature in the release, so PGO seems like a good place to start for .NET 9.

As a brief refresher, dynamic PGO is a feature that enables the JIT to profile code and use what it learns from that profiling to help it generate more efficient code based on the exact usage patterns of the application. The JIT utilizes tiered compilation, which allows code to be compiled and then re-compiled, possibly multiple times, achieving something new each time the code is compiled. For example, a typical method might start out at “tier 0,” where the JIT applies very few optimizations and has a goal of simply getting to functional assembly as quickly as possible. This helps with startup performance, as optimizations are one of the most costly things a compiler does. Then the runtime tracks the number of times the method is invoked, and if the number of invocations trips over a particular threshold, such that it seems like performance could actually matter, the JIT will re-generate code for it, still at tier 0, but this time with a bunch of additional instrumentation injected into the method, tracking all manner of things that could help the JIT better optimize, e.g. for a given virtual dispatch, what is the most common type on which the call is being performed. Then after enough data has been gathered, the JIT can compile the method yet again, this time at “tier 1,” fully optimized, also incorporating all of the learnings from that profile data. This same flow is relevant as well for code that’s already been pre-compiled with ReadyToRun (R2R), except instead of instrumenting tier 0 code, the JIT will generate optimized, instrumented code on its way to generating a re-optimized implementation.

In .NET 8, the JIT in particular paid attention to PGO data about types and methods involved in virtual, interface, and delegate dispatch. In .NET 9, it’s also able to use PGO data to optimize casts. Thanks to [dotnet/runtime#90594](https://github.com/dotnet/runtime/pull/90594), [dotnet/runtime#90735](https://github.com/dotnet/runtime/pull/90735), [dotnet/runtime#96597](https://github.com/dotnet/runtime/pull/96597), [dotnet/runtime#96731](https://github.com/dotnet/runtime/pull/96731), and [dotnet/runtime#97773](https://github.com/dotnet/runtime/pull/97773), dynamic PGO is now able to track the most common input types to cast operations (`castclass`/`isinst`, e.g. what you get from doing operations like `(T)obj` or `obj is T`), and then when generating the optimized code, emit special checks that add fast paths for the most common types. For example, in the following benchmark, we have a field of type `A` initialized to a type `C` that’s derived from both `B` and `A`. Then the benchmark is type checking the instance stored in that `A` field to see whether it’s a `B` or anything derived from `B`.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser(maxDepth: 0)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private A _obj = new C();
    
        [Benchmark]
        public bool IsInstanceOf() => _obj is B;
    
        public class A { }
        public class B : A { }
        public class C : B { }
    }

That `IsInstanceOf` benchmark results in the following disassembly on .NET 8:

    ; Tests.IsInstanceOf()
           push      rax
           mov       rsi,[rdi+8]
           mov       rdi,offset MT_Tests+B
           call      qword ptr [7F3D91524360]; System.Runtime.CompilerServices.CastHelpers.IsInstanceOfClass(Void*, System.Object)
           test      rax,rax
           setne     al
           movzx     eax,al
           add       rsp,8
           ret
    ; Total bytes of code 35

but now on .NET 9, it produces this:

    ; Tests.IsInstanceOf()
           push      rbp
           mov       rbp,rsp
           mov       rsi,[rdi+8]
           mov       rcx,rsi
           test      rcx,rcx
           je        short M00_L00
           mov       rax,offset MT_Tests+C
           cmp       [rcx],rax
           jne       short M00_L01
    M00_L00:
           test      rcx,rcx
           setne     al
           movzx     eax,al
           pop       rbp
           ret
    M00_L01:
           mov       rdi,offset MT_Tests+B
           call      System.Runtime.CompilerServices.CastHelpers.IsInstanceOfClass(Void*, System.Object)
           mov       rcx,rax
           jmp       short M00_L00
    ; Total bytes of code 62

On .NET 8, it’s loading the reference to the object and the desired method token for `B`, and calling the `CastHelpers.IsInstanceOfClass` JIT helper to do the type check. On .NET 9, instead it’s loading the method token for `C`, which it saw during profiling to be the most common type used, and then comparing that against the actual object’s method token. If they match, since the JIT knows that `C` derives from `B`, it then knows the object is in fact a `B`. If they don’t match, then it jumps down to the fallback path where it does the same thing that was being done on .NET 8, loading the reference and the desired method token for `B` and calling `IsInstanceOfClass`.

It’s also capable of optimizing for the negative case where the cast most often fails. Consider this benchmark:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser(maxDepth: 0)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private object _obj = "hello";
    
        [Benchmark]
        public bool IsInstanceOf() => _obj is Tests;
    }

On .NET 9, we get this assembly:

    ; Tests.IsInstanceOf()
           push      rbp
           mov       rbp,rsp
           mov       rsi,[rdi+8]
           mov       rcx,rsi
           test      rcx,rcx
           je        short M00_L00
           mov       rax,offset MT_System.String
           cmp       [rcx],rax
           jne       short M00_L01
           xor       ecx,ecx
    M00_L00:
           test      rcx,rcx
           setne     al
           movzx     eax,al
           pop       rbp
           ret
    M00_L01:
           mov       rdi,offset MT_Tests
           call      System.Runtime.CompilerServices.CastHelpers.IsInstanceOfClass(Void*, System.Object)
           mov       rcx,rax
           jmp       short M00_L00
    ; Total bytes of code 64

Here the incoming object is always a `string` and never the `Tests` class that’s being tested for. The generated code is comparing the incoming object against `string`, and then, assuming the types match, the JIT knows the object is not a `Tests`.

[dotnet/runtime#96311](https://github.com/dotnet/runtime/pull/96311) also breaks new ground with dynamic PGO, by teaching it how to profile integers and paying attention to their most common values. Then in conjunction with [dotnet/runtime#96571](https://github.com/dotnet/runtime/pull/96571), it uses this super power to optimize `Buffer.Memmove` (which is the workhorse behind methods like `Span<T>.CopyTo`) and `SpanHelpers.SequenceEqual` (which is the implementation behind methods like `string.Equals`). Previously, the JIT was taught how to unroll such operations, where if a constant length was provided, the JIT could generate the exact code sequence to implement the operation for that length. Now with this capability, the JIT can track the most common lengths provided to these methods, and if there’s one length that really stands out, it can special-case it, unrolling and vectorizing the operation when the length matches and falling back to calling the original when it doesn’t. While this is expected to improve in the future, for .NET 9 this set of length-profiling optimizations only kicks in when R2R is disabled, as the JIT is otherwise unable to do the exact profiling required. Disabling R2R is something services can do when startup performance isn’t a big concern and they instead care about maximum throughput at run-time.

    // dotnet run -c Release -f net8.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Configs;
    using BenchmarkDotNet.Environments;
    using BenchmarkDotNet.Jobs;
    using BenchmarkDotNet.Running;
    
    var config = DefaultConfig.Instance
        .AddJob(Job.Default.WithId(".NET 8").WithRuntime(CoreRuntime.Core80).WithEnvironmentVariable("DOTNET_ReadyToRun", "0"))
        .AddJob(Job.Default.WithId(".NET 9").WithRuntime(CoreRuntime.Core90).WithEnvironmentVariable("DOTNET_ReadyToRun", "0"));
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args, config);
    
    [DisassemblyDiagnoser(maxDepth: 0)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD", "a", "b")]
    public class Tests
    {
        [Benchmark]
        [Arguments("abcd", "abcg")]
        public bool Equals(string a, string b) => a == b;
    }

Method

Runtime

Mean

Code Size

Equals

.NET 8.0

2.8592 ns

78 B

Equals

.NET 9.0

0.6754 ns

87 B

### Tier 0

Tier 0 is all about getting to functioning code quickly, and as such most optimizations are disabled. However, every now and then there’s a reason to do a bit more optimization in tier 0, in situations where the benefits of doing so outweigh the cons. Several of those occurred in .NET 9.

[dotnet/runtime#104815](https://github.com/dotnet/runtime/pull/104815) is a simple example. The `ArgumentNullException.ThrowIfNull` method is now used in thousands upon thousands of places for doing argument validation. It’s a non-generic method, accepting an `object` argument and checking to see whether it’s `null`. That non-genericity causes some friction for folks when it’s used with value types. It’s rare for someone to directly call `ThrowIfNull` with a value type (other than maybe with a `Nullable<T>`), and in fact if they do, thanks to [dotnet/roslyn-analyzers](https://github.com/dotnet/roslyn-analyzers/pull/6815) from [@CollinAlpert](https://github.com/CollinAlpert), there’s now the [CA2264](https://learn.microsoft.com/dotnet/fundamentals/code-analysis/quality-rules/ca2264) analyzer that will warn that what’s being done is nonsensical: ![CA2264 using ThrowIfNull with a value type](https://devblogs.microsoft.com/dotnet/wp-content/uploads/sites/10/2024/09/CA2264ThrowIfNullValueType.png) Instead, the common case is when the argument being validated is an unconstrained generic. In such cases, if the generic argument ends up being a value type, it’ll be boxed in the call to `ThrowIfNull`. That boxing allocation gets removed in tier 1, because the `ThrowIfNull` call gets inlined and the JIT can see at the call site that the boxing was unnecessary. But, because inlining doesn’t happen in tier 0, such boxing has remained in tier 0. As the API is so ubiquitous, this caused developers to fret that there was something bad happening, and it caused enough consternation that the JIT now special-cases `ArgumentNullException.ThrowIfNull` and avoids the boxing, even in tier 0. This is easy to see with a little test console app:

    // dotnet run -c Release -f net8.0 --filter "*"
    // dotnet run -c Release -f net9.0 --filter "*"
    
    using System.Runtime.CompilerServices;
    
    while (true)
    {
        Test();
    }
    
    [MethodImpl(MethodImplOptions.NoInlining)]
    static void Test()
    {
        long gc = GC.GetAllocatedBytesForCurrentThread();
        for (int i = 0; i < 100; i++)
        {
            ThrowIfNull(i);
        }
        gc = GC.GetAllocatedBytesForCurrentThread() - gc;
    
        Console.WriteLine(gc);
        Thread.Sleep(1000);
    }
    
    static void ThrowIfNull<T>(T value) => ArgumentNullException.ThrowIfNull(value);

When I run that on .NET 8, I get results like this:

    2400
    2400
    2400
    0
    0
    0

The first few iterations are invoking `Test()` at tier 0, such that each call to `ArgumentNullException.ThrowIfNull` boxes the input `int`. Then when the method gets recompiled at tier 1, the boxing gets elided, and we stabilize at zero allocation. Now on .NET 9, I get results like this:

    0
    0
    0
    0
    0
    0

With these tweaks to tier 0, the boxing is also elided in tier 0, and so starts out without any allocation.

Another tier 0 boxing example is [dotnet/runtime#90496](https://github.com/dotnet/runtime/pull/90496). There’s a hot path method in the `async`/`await` machinery: `AsyncTaskMethodBuilder<TResult>.AwaitUnsafeOnCompleted` (see [How Async/Await Really Works in C#](https://devblogs.microsoft.com/dotnet/how-async-await-really-works/) for all the details). It’s really important that this method be optimized well, but it performs various type tests that can end up boxing in tier 0. In a previous release, that boxing was deemed too impactful to startup for `async` methods invoked early in an application’s lifetime, so `[MethodImpl(MethodImplOptions.AggressiveOptimization)]` was used to opt the method out of tiering, such that it gets optimized from the get-go. But that itself has downsides, because if it skips tiering up, it also skips dynamic PGO, and thus the optimized code isn’t as good as it possibly could be. So, this PR specifically addresses those type tests patterns that box, removing the boxing in tier 0, enabling removing that `AggressiveOptimization` from `AwaitUnsafeOnCompleted`, and thereby enabling better optimized code generation for it.

Optimizations are avoided in tier 0 because they might slow down compilation. If there are really cheap optimizations, though, and they can have a meaningful impact, they can be worth enabling. That’s especially true if the optimizations can actually help to make compilations and startup faster, such as by minimizing calls to helpers that may take locks, trigger certain kinds of loading, etc. And that’s what [dotnet/runtime#105190](https://github.com/dotnet/runtime/pull/105190) does, enabling some constant folding in tier 0 at relatively little cost. Even with the low cost, though, there were still concerns about possible impact to JIT throughput, and the PR was fast-followed by [dotnet/runtime#105250](https://github.com/dotnet/runtime/pull/105250) which optimized some JIT code paths to make up for any impact from the former change.

Another similar case is [dotnet/runtime#91403](https://github.com/dotnet/runtime/pull/91403) from [@MichalPetryka](https://github.com/MichalPetryka), which allows optimizations around `RuntimeHelpers.CreateSpan` to kick in for tier 0. Without that, the runtime can end up allocating many field stubs, which themselves add overhead to the startup path.

### Loops

Applications spend a lot of time iterating through loops, and finding ways to reduce the overheads of loops has been a key focus for .NET 9. It’s also been quite successful.

[dotnet/runtime#102261](https://github.com/dotnet/runtime/pull/102261) and [dotnet/runtime#103181](https://github.com/dotnet/runtime/pull/103181) help to remove some instructions from even the tightest of loops by converting upward counting loops into downward counting loops. Consider a loop like the following:

    // dotnet run -c Release -f net8.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        public int UpwardCounting()
        {
            int count = 0;
            for (int i = 0; i < 100; i++)
            {
                count++;
            }
            return count;
        }
    }

Here’s what the generated assembly code for that core loop looks like on .NET 8:

    M00_L00:
           inc       eax
           inc       ecx
           cmp       ecx,64
           jl        short M00_L00

It’s incrementing `eax`, which is storing `count`. And it’s incrementing `ecx`, which is storing `i`. It’s then comparing `ecx` against 100 (0x64) to see if it’s reached the end of the loop, and jumping back up to the beginning of the loop if it hasn’t.

Now let’s manually rewrite the loop to be downward counting:

    // dotnet run -c Release -f net8.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        public int DownwardCounting()
        {
            int count = 0;
            for (int i = 99; i >= 0; i--)
            {
                count++;
            }
            return count;
        }
    }

And here’s what the generated assembly code for that core loop looks like there:

    M00_L00:
           inc       eax
           dec       ecx
           jns       short M00_L00

The key observation here is that by counting down, we can replace a `cmp`/`jl` for comparing against a specific bound to instead just be a `jns` that jumps if the value isn’t negative. We’ve thus removed an instruction from a tight loop that only had four to begin with. With the aforementioned PRs, the JIT can now do that transformation automatically where it’s applicable and deemed valuable, such that the loop in `UpwardCounting` now results in the same assembly code on .NET 9 as does the loop in `DownwardCounting`.

Method

Runtime

Mean

Ratio

UpwardCounting

.NET 8.0

30.27 ns

1.00

UpwardCounting

.NET 9.0

26.52 ns

0.88

However, the JIT is only able to do this transformation if the iteration variable (`i`) isn’t used in the body of the loop, and obviously there are many loops where it is, such as by indexing into an array being iterated over. Thankfully, other optimizations in .NET 9 are able to reduce the actual reliance on the iteration variable, such that this optimization now kicks in frequently.

One such optimization is strength reduction in loops. In compilers, “strength reduction” is the simple idea of taking something relatively expensive and replacing it with something cheaper. In the context of loops, that typically means introducing more “induction variables” (variables whose values change in a predictable pattern on each iteration, such as being incremented by a constant amount). For example, consider a simple loop that sums all of the elements of an array:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private int[] _array = Enumerable.Range(0, 1000).ToArray();
    
        [Benchmark]
        public int Sum()
        {
            int[] array = _array;
            int sum = 0;
    
            for (int i = 0; i < array.Length; i++)
            {
                sum += array[i];
            }
    
            return sum;
        }
    }

We get the following assembly on .NET 8:

    ; Tests.Sum()
           push      rbp
           mov       rbp,rsp
           mov       rax,[rdi+8]
           xor       ecx,ecx
           xor       edx,edx
           mov       edi,[rax+8]
           test      edi,edi
           jle       short M00_L01
    M00_L00:
           mov       esi,edx
           add       ecx,[rax+rsi*4+10]
           inc       edx
           cmp       edi,edx
           jg        short M00_L00
    M00_L01:
           mov       eax,ecx
           pop       rbp
           ret
    ; Total bytes of code 35

The interesting part is the loop starting at `M00_L00`. `i` is being stored in `edx` (though it gets copied into `esi`), and as part of adding the next element from the array to `sum` (which is stored in `ecx`), we’re loading that next value from the array with the address `rax+rsi*4+10`. A strength reduction view of this would say “rather than re-computing the address on each iteration, we can instead have another induction variable and increment it by 4 on each iteration.” A key benefit of that is it then removes a dependency on `i` from inside of the loop, which then means the iteration variable is no longer used in the loop, enabling the aforementioned downward counting optimization to kick in. That leads to the following assembly on .NET 9:

    ; Tests.Sum()
           push      rbp
           mov       rbp,rsp
           mov       rax,[rdi+8]
           xor       ecx,ecx
           mov       edx,[rax+8]
           test      edx,edx
           jle       short M00_L01
           add       rax,10
    M00_L00:
           add       ecx,[rax]
           add       rax,4
           dec       edx
           jne       short M00_L00
    M00_L01:
           mov       eax,ecx
           pop       rbp
           ret
    ; Total bytes of code 35

Note the loop at `M00_L00`: it’s now downward counting, reading the next value from the array is simply dereferencing the address in `rax`, and the address in `rax` is incremented by 4 each go around.

A lot of work went into enabling this strength reduction, including providing the basic implementation ([dotnet/runtime#104243](https://github.com/dotnet/runtime/pull/104243)), enabling it by default ([dotnet/runtime#105131](https://github.com/dotnet/runtime/pull/105131)), finding more opportunities to apply it ([dotnet/runtime#105169](https://github.com/dotnet/runtime/pull/105169)), and using it to enable post-indexed addressing ([dotnet/runtime#105181](https://github.com/dotnet/runtime/pull/105181) and [dotnet/runtime#105185](https://github.com/dotnet/runtime/pull/105185)), which is an Arm addressing mode where the address stored in the base register is used but then that register is updated to point to the next target memory location. A new phase was also added to the JIT to help with optimizing such induction variables ([dotnet/runtime#97865](https://github.com/dotnet/runtime/pull/97865)), and in particular, to do induction variable widening where 32-bit induction variables (think of every loop you’ve ever written that starts with `for (int i = ...)`) are widened to 64-bit induction variables. This widening can help to avoid zero extensions that might otherwise occur on every iteration of the loop.

These optimizations are all new, but of course there are also many loop optimizations already present in the JIT compiler, from loop unrolling to loop cloning to loop hoisting. In order to apply such loop optimizations, though, the JIT first needs to recognize loops, and that can sometimes be more challenging than it would seem ([dotnet/runtime#43713](https://github.com/dotnet/runtime/issues/43713#issue-727046316) describes a case where the JIT was failing to do so). Historically, the JIT’s loop recognition was based on a relatively simplistic lexical analysis. In .NET 8, as part of the work to improve dynamic PGO, a more powerful graph-based loop analyzer was added that was able to recognize many more loops. For .NET 9 with [dotnet/runtime#95251](https://github.com/dotnet/runtime/pull/95251), that analyzer was factored out so that it could be used for generalized loop reasoning. And then with PRs like [dotnet/runtime#96756](https://github.com/dotnet/runtime/pull/96756) for loop alignment, [dotnet/runtime#96754](https://github.com/dotnet/runtime/pull/96754) and [dotnet/runtime#96553](https://github.com/dotnet/runtime/pull/96553) for loop cloning, [dotnet/runtime#96752](https://github.com/dotnet/runtime/pull/96752) for loop unrolling, [dotnet/runtime#96751](https://github.com/dotnet/runtime/pull/96751) for loop canonicalization, and [dotnet/runtime#96753](https://github.com/dotnet/runtime/pull/96753) for loop hoisting, many of these loop-related optimizations have now been moved to the better scheme. All of that means that more loops get optimized.

### Bounds Checks

.NET code is, by default, “memory safe.” Unlike in C, where you can iterate through an array and easily walk off the end of it, by default accesses to arrays, strings, and spans are “bounds checked” to ensure you can’t walk off the end or before the beginning. Of course, such bounds checking adds overhead, and so wherever the JIT can prove that adding such checks would be unnecessary, it’ll elide the bounds check, knowing that it’s impossible for the guarded accesses to be problematic. The quintessential example of this is a loop over an array from `0` to `array.Length`. Let’s look at the same benchmark we just looked at, summing all the elements of an integer array:

    // dotnet run -c Release -f net8.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser(maxDepth: 0)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private int[] _array = new int[1000];
    
        [Benchmark]
        public int Test()
        {
            int[] array = _array;
    
            int sum = 0;
            for (int i = 0; i < array.Length; i++)
            {
                sum += array[i];
            }
            return sum;
        }
    }

That `Test` benchmark results in this assembly code on .NET 8:

    ; Tests.Test()
           push      rbp
           mov       rbp,rsp
           mov       rax,[rdi+8]
           xor       ecx,ecx
           xor       edx,edx
           mov       edi,[rax+8]
           test      edi,edi
           jle       short M00_L01
    M00_L00:
           mov       esi,edx
           add       ecx,[rax+rsi*4+10]
           inc       edx
           cmp       edi,edx
           jg        short M00_L00
    M00_L01:
           mov       eax,ecx
           pop       rbp
           ret
    ; Total bytes of code 35

The key part to pay attention to is the loop at `M00_L00`, for which the only branch is the one comparing `edx` (which is tracking `i`) to `edi` (which was earlier on initialized to the length of the array, `[rax+8]`) as part of knowing when it’s done iterating. There’s no additional check required to make this safe, as the JIT knows the loop started at `0` (and thus isn’t walking off the beginning of the array) and the JIT knows iteration ends at the array length, which the JIT is already checking for, so it’s safe to index into the array without additional checks.

Now, let’s tweak the benchmark ever so slightly. In the above, I was copying the `_array` field to a local `array` and then doing all accesses against that `array`; this is critical, because there’s nothing else that could be changing that local out from under the loop. But if we instead change the code to refer to the field directly:

    // dotnet run -c Release -f net8.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser(maxDepth: 0)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private int[] _array = new int[1000];
    
        [Benchmark]
        public int Test()
        {
            int sum = 0;
            for (int i = 0; i < _array.Length; i++)
            {
                sum += _array[i];
            }
            return sum;
        }
    }

now we get this on .NET 8:

    ; Tests.Test()
           push      rbp
           mov       rbp,rsp
           xor       eax,eax
           xor       ecx,ecx
           mov       rdx,[rdi+8]
           cmp       dword ptr [rdx+8],0
           jle       short M00_L01
           nop       dword ptr [rax]
           nop       dword ptr [rax]
    M00_L00:
           mov       rdi,rdx
           cmp       ecx,[rdi+8]
           jae       short M00_L02
           mov       esi,ecx
           add       eax,[rdi+rsi*4+10]
           inc       ecx
           cmp       [rdx+8],ecx
           jg        short M00_L00
    M00_L01:
           pop       rbp
           ret
    M00_L02:
           call      CORINFO_HELP_RNGCHKFAIL
           int       3
    ; Total bytes of code 61

That’s a whole lot worse. Note how much that loop starting at `M00_L00` has grown, and in particular note that instead of just having the one `cmp`/`jg` pair at the end, there’s another `cmp`/`jae` pair in the middle, just before it accesses the array element. Since the code is reading from the field on every access, the JIT needs to accommodate the fact that the reference could change between any two accesses; thus, even though the JIT is comparing against `_array.Length` as part of the loop bounds, it also needs to ensure that the subsequent reference to `_array[i]` is still in bounds, since by then `_array` may be an entirely different object. That’s a “bounds check,” which is obvious from the tell-tale sign that immediately after the `cmp`, there’s a conditional jump to code that unconditionally calls `CORINFO_HELP_RNGCHKFAIL`; that’s the helper function that’s called to throw an `IndexOutOfRangeException` when you try to walk off the end of one of these data structures.

Every release the JIT gets better at removing more and more bounds checks where it can prove they’re superfluous. One of my favorite such improvements in .NET 9 is there on my favorites list because I’ve historically expected the optimization to “just work”, for various reasons it didn’t, and now it does (it also shows up in a fair amount of real code, which is why I’ve bumped up against it). In this benchmark, the function is handed an offset and a span, and its job is to sum all of the numbers from that offset to the end of the span.

    // dotnet run -c Release -f net8.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Runtime.CompilerServices;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        [Arguments(3)]
        public int Test() => M(0, "1234567890abcdefghijklmnopqrstuvwxyz");
    
        [MethodImpl(MethodImplOptions.NoInlining)]
        public static int M(int i, ReadOnlySpan<char> src)
        {
            int sum = 0;
    
            while (true)
            {
                if ((uint)i >= src.Length)
                {
                    break;
                }
    
                sum += src[i++];
            }
    
            return sum;
        }
    }

By casting `i` to `uint` as part of the comparison to `src.Length`, the JIT knows that `i` is in bounds of `src` by the time `i` is used to index into `src`, because if `i` were negative, the cast to `uint` would have made it larger than `int.MaxValue` and thus also larger than `src.Length` (which can’t possibly be larger than `int.MaxValue`). The .NET 8 assembly shows the bounds check has been elided (note the lack of `CORINFO_HELP_RNGCHKFAIL`):

    ; Tests.M(Int32, System.ReadOnlySpan`1<Char>)
           push      rbp
           mov       rbp,rsp
           xor       eax,eax
    M01_L00:
           cmp       edi,edx
           jae       short M01_L01
           lea       ecx,[rdi+1]
           mov       edi,edi
           movzx     edi,word ptr [rsi+rdi*2]
           add       eax,edi
           mov       edi,ecx
           jmp       short M01_L00
    M01_L01:
           pop       rbp
           ret
    ; Total bytes of code 27

But, this is a fairly awkward way to write such a condition. A more natural way would be to have that check as part of the loop condition:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Runtime.CompilerServices;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        [Arguments(3)]
        public int Test() => M(0, "1234567890abcdefghijklmnopqrstuvwxyz");
    
        [MethodImpl(MethodImplOptions.NoInlining)]
        public static int M(int i, ReadOnlySpan<char> src)
        {
            int sum = 0;
    
            for (; (uint)i < src.Length; i++)
            {
                sum += src[i];
            }
    
            return sum;
        }
    }

Unfortunately, as a result of my code cleanup here to make the code more canonical, the JIT in .NET 8 fails to see that the bounds check can be elided… note the `CORINFO_HELP_RNGCHKFAIL` at the end:

    ; Tests.M(Int32, System.ReadOnlySpan`1<Char>)
           push      rbp
           mov       rbp,rsp
           xor       eax,eax
           cmp       edi,edx
           jae       short M01_L01
    M01_L00:
           cmp       edi,edx
           jae       short M01_L02
           mov       ecx,edi
           movzx     ecx,word ptr [rsi+rcx*2]
           add       eax,ecx
           inc       edi
           cmp       edi,edx
           jb        short M01_L00
    M01_L01:
           pop       rbp
           ret
    M01_L02:
           call      CORINFO_HELP_RNGCHKFAIL
           int       3
    ; Total bytes of code 36

But in .NET 9, thanks to [dotnet/runtime#100777](https://github.com/dotnet/runtime/pull/100777), the JIT is better able to track the knowledge about guarantees made by the loop condition and is able to elide the bounds check on this variation as well.

    ; Tests.M(Int32, System.ReadOnlySpan`1<Char>)
           push      rbp
           mov       rbp,rsp
           xor       eax,eax
           cmp       edi,edx
           jae       short M01_L01
           mov       ecx,edi
    M01_L00:
           movzx     edi,word ptr [rsi+rcx*2]
           add       eax,edi
           inc       ecx
           cmp       ecx,edx
           jb        short M01_L00
    M01_L01:
           pop       rbp
           ret
    ; Total bytes of code 26

Yay!

Now consider this benchmark:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser(maxDepth: 0)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        [Arguments(3)]
        public int Test(int i)
        {
            ReadOnlySpan<byte> rva = [1, 2, 3, 5, 8, 13, 21, 34];
            return rva[7 - (i & 7)];
        }
    }

The test method here has a span of data initialized in a way where the JIT is able to see how long it is. It’s then indexing into the span, using the supplied index to read not from the start but from the end (the `(i & 7)` is there to ensure the JIT can see that the value will always be in range); if it were reading from the start, this was already optimized, but from the end, the JIT hadn’t previously been taught how to reason about the bounds checks. On .NET 8, it can’t prove the access is always in-bounds, and we can see the bounds check in place:

    ; Tests.Test(Int32)
           push      rax
           and       esi,7
           mov       eax,esi
           neg       eax
           add       eax,7
           cmp       eax,8
           jae       short M00_L00
           mov       rcx,7FC98A741EC8
           movzx     eax,byte ptr [rax+rcx]
           add       rsp,8
           ret
    M00_L00:
           call      CORINFO_HELP_RNGCHKFAIL
           int       3
    ; Total bytes of code 41

But, now on .NET 9, thanks to [dotnet/runtime#96123](https://github.com/dotnet/runtime/pull/96123), the bounds check gets elided.

    ; Tests.Test(Int32)
           and       esi,7
           mov       eax,esi
           neg       eax
           add       eax,7
           mov       rcx,7F39B8724EC8
           movzx     eax,byte ptr [rax+rcx]
           ret
    ; Total bytes of code 25

Here’s another case. We’re special-casing spans of lengths less than or equal to 1, returning `string.Empty` if the span is of length 0 or returning the first string if the span is of length 1:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Runtime.CompilerServices;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        [Arguments(3)]
        public string? Test() => M(["123"]);
    
        [MethodImpl(MethodImplOptions.NoInlining)]
        private static string? M(ReadOnlySpan<string> values)
        {
            if (values.Length <= 1)
            {
                return values.Length == 0 ?
                    string.Empty :
                    values[0];
            }
    
            return null;
        }
    }

You and I can see that the access to `values[0]` will always succeed, but on .NET 8 we get this:

    ; Tests.M(System.ReadOnlySpan`1<System.String>)
           push      rbp
           mov       rbp,rsp
           cmp       esi,1
           jg        short M01_L01
           test      esi,esi
           je        short M01_L00
           test      esi,esi
           je        short M01_L02
           mov       rax,[rdi]
           pop       rbp
           ret
    M01_L00:
           mov       rax,7FB62147C008
           pop       rbp
           ret
    M01_L01:
           xor       eax,eax
           pop       rbp
           ret
    M01_L02:
           call      CORINFO_HELP_RNGCHKFAIL
           int       3
    ; Total bytes of code 44

The JIT keeps track of what it knows about the lengths of various things, what conditions it’s proved, but here it’s lost track of the fact that, for the else branch of the ternary, `values` is guaranteed to be of length `1`, and thus indexing at index `0` is safe. [dotnet/runtime#101323](https://github.com/dotnet/runtime/pull/101323) improves the JIT’s range tracking ability, such that on .NET 9, the bounds check is successfully elided:

    ; Tests.M(System.ReadOnlySpan`1<System.String>)
           push      rbp
           mov       rbp,rsp
           cmp       esi,1
           jg        short M01_L01
           test      esi,esi
           je        short M01_L00
           mov       rax,[rdi]
           pop       rbp
           ret
    M01_L00:
           mov       rax,7F5700FB1008
           pop       rbp
           ret
    M01_L01:
           xor       eax,eax
           pop       rbp
           ret
    ; Total bytes of code 34

Most if not all of these bounds check elimination improvements come about because someone is optimizing something and sees a bounds check that could have been eliminated but wasn’t. In the case that inspired the improvement in [dotnet/runtime#101352](https://github.com/dotnet/runtime/pull/101352), that someone was me, while working on improving `Enum` for .NET 8. Enums can be backed by various numerical types, including `ulong`, and there’s a code path in `Enum.GetName` that’s effectively this:

    if (ulongValue < (ulong)names.Length)
    {
        return names[(uint)ulongValue];
    }

That bounds check wasn’t previously being removed, but now in .NET 9, it is:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private readonly string[] _names = Enum.GetNames<MyEnum>();
    
        [Benchmark]
        [Arguments(2)]
        public string? GetNameOrNull(ulong ulValue)
        {
            string[] names = _names;
            return ulValue < (ulong)names.Length ?
                names[(uint)ulValue] :
                null;
        }
    
        public enum MyEnum : ulong { A, B, C, D }
    }

    // .NET 8
    ; Tests.GetNameOrNull(UInt64)
           push      rbp
           mov       rbp,rsp
           mov       rax,[rdi+8]
           mov       ecx,[rax+8]
           mov       edx,ecx
           cmp       rdx,rsi
           jbe       short M00_L00
           cmp       esi,ecx
           jae       short M00_L01
           mov       ecx,esi
           mov       rax,[rax+rcx*8+10]
           pop       rbp
           ret
    M00_L00:
           xor       eax,eax
           pop       rbp
           ret
    M00_L01:
           call      CORINFO_HELP_RNGCHKFAIL
           int       3
    ; Total bytes of code 41
    
    // .NET 9
    ; Tests.GetNameOrNull(UInt64)
           mov       rax,[rdi+8]
           mov       ecx,[rax+8]
           cmp       rcx,rsi
           jbe       short M00_L00
           mov       ecx,esi
           mov       rax,[rax+rcx*8+10]
           ret
    M00_L00:
           xor       eax,eax
           ret
    ; Total bytes of code 23

Sometimes eliding bounds checks is about learning new tricks; other times, it’s about fixing old ones. Consider this benchmark:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private static ReadOnlySpan<int> Lookup => [1, 2, 3, 5, 8, 13, 21];
    
        [Benchmark]
        [Arguments(3)]
        public int Test1(int i) => (uint)i < 7 ? Lookup[i] : -1;
    
        [Benchmark]
        [Arguments(3)]
        public int Test2(int i) => (uint)i <= 6 ? Lookup[i] : -1;
    }

`Test1` and `Test2` are effectively the same thing, both guarding a lookup table by a known length and only accessing the table if we know the index to be in bounds. The bounds check will then be elided by the JIT in both cases, right? Wrong. On .NET 8, we get this:

    ; Tests.Test1(Int32)
           cmp       esi,7
           jae       short M00_L00
           mov       eax,esi
           mov       rcx,7F6D40064030
           mov       eax,[rcx+rax*4]
           ret
    M00_L00:
           mov       eax,0FFFFFFFF
           ret
    ; Total bytes of code 27
    
    ; Tests.Test2(Int32)
           push      rbp
           mov       rbp,rsp
           cmp       esi,6
           ja        short M00_L00
           cmp       esi,7
           jae       short M00_L01
           mov       eax,esi
           mov       rcx,7F8D11621030
           mov       eax,[rcx+rax*4]
           pop       rbp
           ret
    M00_L00:
           mov       eax,0FFFFFFFF
           pop       rbp
           ret
    M00_L01:
           call      CORINFO_HELP_RNGCHKFAIL
           int       3
    ; Total bytes of code 44

Note the bounds check in `Test2`. [dotnet/runtime#97908](https://github.com/dotnet/runtime/pull/97908) fixes this, such that on .NET 9 `Test2` now successfully elides the bounds check as well:

    ; Tests.Test1(Int32)
           cmp       esi,7
           jae       short M00_L00
           mov       eax,esi
           mov       rcx,7F5B9DC5E030
           mov       eax,[rcx+rax*4]
           ret
    M00_L00:
           mov       eax,0FFFFFFFF
           ret
    ; Total bytes of code 27
    
    ; Tests.Test2(Int32)
           cmp       esi,6
           ja        short M00_L00
           mov       eax,esi
           mov       rcx,7F7FDE2C9030
           mov       eax,[rcx+rax*4]
           ret
    M00_L00:
           mov       eax,0FFFFFFFF
           ret
    ; Total bytes of code 27

Interestingly, sometimes even if we can’t elide a bounds check, we can learn things from the fact that one occurred, and then use that knowledge to optimize subsequent things. Consider this benchmark:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private readonly int[] _x = new int[10];
    
        [Benchmark]
        [Arguments(2)]
        public int Add(int y) => _x[y] + (y % 8);
    }

There’s nothing the JIT can do here to elide the bounds check on `_x[y]`; it has no information about the value of `y` or the length of `_x`. As such, as shown in the .NET 8 assembly here, we see a bounds check:

    
    ; Tests.Add(Int32)
           push      rax
           mov       rax,[rdi+8]
           cmp       esi,[rax+8]
           jae       short M00_L00
           mov       ecx,esi
           mov       edx,esi
           sar       edx,1F
           and       edx,7
           add       edx,esi
           and       edx,0FFFFFFF8
           mov       edi,esi
           sub       edi,edx
           add       edi,[rax+rcx*4+10]
           mov       eax,edi
           add       rsp,8
           ret
    M00_L00:
           call      CORINFO_HELP_RNGCHKFAIL
           int       3
    ; Total bytes of code 46

However, all is not lost. After indexing into the array, we proceed to use `y` as the numerator of a `%` operation. C#’s `%` operator supports both `int` and `uint` numerators, but it has to do a little more work for `int` in case the value is negative. However, by the time we get to that `%` operation, we _know_ that `y` is not negative, as if it were negative, the `_x[y]` would have thrown and we’d never end up here. [dotnet/runtime#102089](https://github.com/dotnet/runtime/pull/102089) teaches the JIT how to learn such non-negative information from such bounds checks, such that in .NET 9, we get code generation equivalent to if we’d explicitly cast `y` to `uint`.

    ; Tests.Add(Int32)
           push      rax
           mov       rax,[rdi+8]
           cmp       esi,[rax+8]
           jae       short M00_L00
           mov       ecx,esi
           and       esi,7
           add       esi,[rax+rcx*4+10]
           mov       eax,esi
           add       rsp,8
           ret
    M00_L00:
           call      CORINFO_HELP_RNGCHKFAIL
           int       3
    ; Total bytes of code 32

### Arm64

Making .NET on Arm an awesome and fast experience has been a critical, multi-year investment. You can read about it in [Arm64 Performance Improvements in .NET 5](https://devblogs.microsoft.com/dotnet/Arm64-performance-in-net-5/), [Arm64 Performance Improvements in .NET 7](https://devblogs.microsoft.com/dotnet/Arm64-performance-improvements-in-dotnet-7/), and [Arm64 Performance Improvements in .NET 8](https://devblogs.microsoft.com/dotnet/this-Arm64-performance-in-dotnet-8/). And things continue to improve even further in .NET 9. Here are some examples:

*   **Better barriers.** [dotnet/runtime#91553](https://github.com/dotnet/runtime/pull/91553) implements volatile writes via using the `stlur` (Store-Release Register) instruction rather than a `dmb` (Data Memory Barrier) / `str` (Store) pair of instructions (`stlur` is generally cheaper). Similarly, [dotnet/runtime#101359](https://github.com/dotnet/runtime/pull/101359) eliminates full memory barriers when dealing with volatile reads and writes on `float`s. For example, code that would previously have produced a `ldr` (Load Register) / `dmb` pair may now produce a `ldar` (Load-Acquire Register) / `fmov` (Floating-point Move) pair.
*   **Better switches.** Depending on the shape of a `switch` statement, the C# compiler may generate a variety of IL patterns, one of which is to use a `switch` IL instruction. Normally for a `switch` IL instruction, the JIT will generate a jump table, but for some forms, it has an optimization to instead rely on a bit test. Thus far this optimization only existed for x86/64, with the `bt` (Bit Test) instruction. Now with [dotnet/runtime#91811](https://github.com/dotnet/runtime/pull/91811), it also exists for Arm, with the `tbz` (Test bit and Branch if Zero) instruction.
*   **Better conditionals.** Arm has conditional instructions that logically contain a branch albeit without any branching, e.g. [Performance Improvements in .NET 8](https://devblogs.microsoft.com/dotnet/performance-improvements-in-net-8/) talked about the `csel` (Conditional Select) instruction that “conditionally selects” a value from one of two registers based on some condition. Another such instruction is `csinc` (Conditional Select Increment), which conditionally selects either the value from one register or the value from another register incremented by one. [dotnet/runtime#91262](https://github.com/dotnet/runtime/pull/91262) from [@c272](https://github.com/c272) enables the JIT to utilize `csinc`, so that a statement like `x = condition ? x + 1 : y;` will be able to compile down to a `csinc` rather than to a branching construct. [dotnet/runtime#92810](https://github.com/dotnet/runtime/pull/92810) also improves the custom comparison operation the JIT emits for some `SequenceEqual` operations (e.g. `"hello, there"u8.SequenceEqual(spanOfBytes)`) to be able to use `ccmp` (Conditional Compare).
*   **Better multiplies.** Arm has single instructions that represent doing a multiply followed by an addition, subtraction, or negation. [dotnet/runtime#91886](https://github.com/dotnet/runtime/pull/91886) from [@c272](https://github.com/c272) finds such sequences of multiplies followed by one of those operations and consolidates them to use the single combined instruction.
*   **Better loads.** Arm has instructions for loading a value from memory into a single register, but it also has instructions for loading multiple values into multiple registers. When the JIT emits a customized memory copy (such as for `byteArray.AsSpan(0, 32).SequenceEqual(otherByteArray)`), it may emit multiple `ldr` instructions for loading a value into a register. [dotnet/runtime#92704](https://github.com/dotnet/runtime/pull/92704) enables consolidating pairs of those into `ldp` (Load Pair of Registers) instructions, which load two values into two registers.

### ARM SVE

Bringing up a new instruction set is a huge deal and a huge undertaking. I’ve mentioned in the past my process for gearing up to write one of these “Performance Improvements in .NET X” posts, including that throughout the year I keep a running list of the PRs I might want to talk about when it comes time to actually put pen to paper. Just for “SVE”, I found myself with over 200 links. I’m not going to bore you with such a laundry list; if you’re interested, you can search for [SVE PRs](https://github.com/dotnet/runtime/pulls?q=is%3Apr+SVE+merged%3A2023-10-01..2024-08-31+), which includes PRs from [@a74nh](https://github.com/a74nh), from [@ebepho](https://github.com/ebepho), from [@mikabl-arm](https://github.com/mikabl-arm), from [@snickolls-arm](https://github.com/snickolls-arm), and from [@SwapnilGaikwad](https://github.com/SwapnilGaikwad). But, we can still talk a bit about what it is and what it means for .NET.

Single instruction, multiple data (SIMD) is a kind of parallel processing where one instruction performs the same operation on multiple pieces of data at the same time, rather than one instruction manipulating just a single piece of data. For example, the `add` instruction on x86/64 can add together one pair of 32-bit integers, whereas the `paddd` (Add Packed Doubleword Integers) instruction that’s part of Intel’s SSE2 (Streaming SIMD Extensions 2) instruction set operates on a pair of `xmm` registers that can each store four 32-bit integer values at once. Many such instructions have been added to many different hardware platforms over the years, coming in groups referred to as instruction set architectures (ISA), where an ISA defines what the instructions are, what registers they interact with, how memory is accessed, and so on. Even if you’re not steeped in this stuff, you’ve likely heard names of these ISAs mentioned, like Intel’s SSE (Streaming SIMD Extensions) and AVX (Advanced Vector Extensions), or Arm’s Advanced SIMD (also known as Neon). In general, the instructions in all of these ISAs operate on a fixed number of values of a fixed size, e.g. the `paddd` previously mentioned only works with 128-bits at a time, no more, no less. Different instructions exist for 256 bits at a time or 512 bits at a time.

SVE, or “Scalable Vector Extensions,” is an ISA from Arm that’s a bit different. The instructions in SVE don’t operate on a fixed size. Rather, the specification allows for them to operate on sizes from 128 bits up to 2048 bits, and the specific hardware can choose which size to use (allowed sizes are multiples of 128, and with SVE 2 further constrained to be powers of 2). The same assembly code using these instructions might operate on 128 bits at a time on one piece of hardware and 256 bits at a time on another piece of hardware.

There are multiple ways such an ISA impacts .NET, and in particular the JIT. The JIT needs to be able to be able to work with the ISA, understand the associated registers and be able to do register allocation, be taught about encoding and emitting the instructions, and so on. The JIT needs to be taught when and where it’s appropriate to use these instructions, so that as part of compiling IL down to assembly, if operating on a machine that supports SVE, the JIT might be able to pick SVE instructions for use in the generated assembly. And the JIT needs to be taught how to represent this data, these vectors, to user code. All of that is a huge amount of work, especially when you consider that there are thousands of operations represented. What makes it even more work is hardware intrinsics.

[Hardware intrinsics](https://devblogs.microsoft.com/dotnet/hardware-intrinsics-in-net-core/) are a feature of .NET where, effectively, each of these instructions shows up as its own dedicated .NET method, such as [`Sse2.Add`](https://learn.microsoft.com/dotnet/api/system.runtime.intrinsics.x86.sse2.add?view=net-8.0#system-runtime-intrinsics-x86-sse2-add), and the JIT emits use of that method as the underlying instruction to which it maps. If you look at [Sve.cs](https://github.com/dotnet/runtime/blob/30eaaf2415b8facf0ef3180c005e27132e334611/src/libraries/System.Private.CoreLib/src/System/Runtime/Intrinsics/Arm/Sve.cs) in dotnet/runtime, you’ll see the `System.Runtime.Intrinsics.Arm.Sve` type, which already exposes more than 1400 public methods (that number is not a typo).

Two interesting things to notice if you open that file (beyond its sheer length):

1.  **The use of `Vector<T>`.** .NET’s foray into SIMD [started in 2014](https://devblogs.microsoft.com/dotnet/the-jit-finally-proposed-jit-and-simd-are-getting-married/) and was accompanied by the `Vector<T>` type. `Vector<T>` represents a single vector (list) of the `T` numeric type. To provide a platform-agnostic representation, since different platforms were capable of different vector widths, `Vector<T>` was defined to be variable in size, so for example on x86/x64 hardware that supported AVX2, `Vector<T>` might be 256 bits wide, whereas on an Arm machine that supported Neon, `Vector<T>` might be 128 bits wide. If the hardware supported both 128 bits and 256 bits, `Vector<T>` would map to the larger. Since the introduction of `Vector<T>`, various fixed-width vector types have been introduced, like `Vector64<T>`, `Vector128<T>`, `Vector256<T>`, and `Vector512<T>`, and the hardware intrinsics for most of the other ISAs are all in terms of those fixed-width vector sizes, since the instructions themselves are fixed width. But SVE is not; its instructions might be 128 bits here and 512 bits there, thus it’s not possible to use those same fixed-width vector types in the `Sve` definition… but it makes a lot of sense to use the variable with `Vector<T>`. What’s old is new again.
2.  **The `Sve` class is tagged as `[Experimental]`.** The [`[Experimental]`](https://learn.microsoft.com/dotnet/api/system.diagnostics.codeanalysis.experimentalattribute?view=net-8.0) attribute was introduced in .NET 8 and C# 12. The intent is it can be used to indicate that some functionality in an otherwise stable assembly is not yet stable and may change in the future. If code tries to use such a member, by default the C# compiler will issue an error telling the developer they’re using something that could break in the future. As long as the developer is willing to accept such breaking change risk, they can then suppress the error. Designing and enabling the SVE support is a monstrous, multi-year effort, and while the support is functional and folks are encouraged to take it for a spin, it’s not yet baked enough for us to be 100% confident the shape won’t need to evolve (for .NET 9, it’s also restricted to hardware with a vector width of 128 bits, but that restriction will be removed subsequently). Hence, `[Experimental]`.

### AVX10.1

Even with the size of the SVE effort, it’s not the only new ISA available in .NET 9. Thanks in large part to [dotnet/runtime#99784](https://github.com/dotnet/runtime/pull/99784) from [@Ruihan-Yin](https://github.com/Ruihan-Yin) and [dotnet/runtime#101938](https://github.com/dotnet/runtime/pull/101938) from [@khushal1996](https://github.com/khushal1996), .NET 9 now also supports AVX10.1 (AVX10 version 1). AVX10.1 provides everything AVX512 provides, all of the base support, the updated encodings, support for embedded broadcasts, masking, and so on, but it only requires 256-bit support in the hardware (with 512-bits being optional, whereas AVX512 requires 512-bit support), and it does so in a much less incremental manner (AVX512 has multiple instruction sets like “F”, “DQ”, “Vbmi”, etc.). That’s modeled in the .NET APIs as well, where you can check `Avx10v1.IsSupported` as well as `Avx10v1.V512.IsSupported`, both of which govern more than 500 new APIs available for consumption. (Note that at the time of this writing, there aren’t actually any chips on the market that support AVX10.1, but they’re expected in the foreseeable future.)

### AVX512

On the subject of ISAs, it’s worth mentioning AVX512. .NET 8 added broad support for AVX512, including support in the JIT and employment of it throughout the libraries. Both of those improve further in .NET 9. We’ll talk more about places it’s better used in the libraries later. For now, here are some JIT-specific improvements.

One of the things the JIT needs to generate code for is zeroing, e.g. by default all locals in a method need to be set to zero, and even if `[SkipLocalsInit]` is employed, references still need to be zeroed (otherwise, when the GC does a pass through all of the locals looking for references to objects to see what’s no longer referenced, it could see the references as being whatever garbage happened to be in that location in memory and end up making bad choices). Such zeroing of locals is overhead that occurs on every invocation of that method, so obviously it’s valuable for that to be as efficient as possible. Rather than zeroing out each word with a single instruction, if the current hardware supports the appropriate SIMD instructions, the JIT can instead emit code to use those instructions, so that it can zero out more per instruction. With [dotnet/runtime#91166](https://github.com/dotnet/runtime/pull/91166), it’s now able to use AVX512 instructions if available to zero out 512 bits per instruction, rather than “only” 256 bits or 128 bits using other ISAs. As an example, here’s a benchmark that needs to zero out 256 bytes:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Runtime.CompilerServices;
    using System.Runtime.InteropServices;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public unsafe class Tests
    {
        [Benchmark]
        public void Sum()
        {
            Bytes values;
            Nop(&values);
        }
    
        [SkipLocalsInit]
        [Benchmark]
        public void SumSkipLocalsInit()
        {
            Bytes values;
            Nop(&values);
        }
    
        [MethodImpl(MethodImplOptions.NoInlining)]
        private static void Nop(Bytes* value) { }
    
        [StructLayout(LayoutKind.Sequential, Size = 256)]
        private struct Bytes { }
    }

Here’s the assembly for `Sum` on .NET 8:

    ; Tests.Sum()
           sub       rsp,108
           xor       eax,eax
           mov       [rsp+8],rax
           vxorps    xmm8,xmm8,xmm8
           mov       rax,0FFFFFFFFFFFFFF10
    M00_L00:
           vmovdqa   xmmword ptr [rsp+rax+100],xmm8
           vmovdqa   xmmword ptr [rsp+rax+110],xmm8
           vmovdqa   xmmword ptr [rsp+rax+120],xmm8
           add       rax,30
           jne       short M00_L00
           mov       [rsp+100],rax
           lea       rdi,[rsp+8]
           call      qword ptr [7F6B56B85CB0]; Tests.Nop(Bytes*)
           nop
           add       rsp,108
           ret
    ; Total bytes of code 90

This is on a machine with AVX512 hardware support, but we can see the zero’ing is happening using a loop (`M00_L00` through to the `jne` that jumps back to it), as with only 256-bit instructions, this was deemed by the JIT’s heuristics too large to unroll completely. Now, here’s .NET 9:

    ; Tests.Sum()
           sub       rsp,108
           xor       eax,eax
           mov       [rsp+8],rax
           vxorps    xmm8,xmm8,xmm8
           vmovdqu32 [rsp+10],zmm8
           vmovdqu32 [rsp+50],zmm8
           vmovdqu32 [rsp+90],zmm8
           vmovdqa   xmmword ptr [rsp+0D0],xmm8
           vmovdqa   xmmword ptr [rsp+0E0],xmm8
           vmovdqa   xmmword ptr [rsp+0F0],xmm8
           mov       [rsp+100],rax
           lea       rdi,[rsp+8]
           call      qword ptr [7F4D3D3A44C8]; Tests.Nop(Bytes*)
           nop
           add       rsp,108
           ret
    ; Total bytes of code 107

Now there’s no loop, because `vmovdqu32` (Move unaligned packed doubleword integer values) can be used to zero twice as much at a time (64 bytes) as vmovdqa (Move aligned packed integer values), and thus the zeroing can be done in fewer instructions that’s still considered a reasonable number.

Zeroing also shows up elsewhere, such as when initializing structs. Those have also previously employed SIMD instructions where relevant, e.g. this:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        public MyStruct Init() => new();
    
        public struct MyStruct
        {
            public Int128 A, B, C, D;
        }
    }

produces this assembly today on .NET 8:

    ; Tests.Init()
           vzeroupper
           vxorps    ymm0,ymm0,ymm0
           vmovdqu32 [rsi],zmm0
           mov       rax,rsi
           ret
    ; Total bytes of code 17

But, if we tweak `MyStruct` to add a field of a reference type anywhere in the struct (e.g. add `public string Oops;` as the first line of the struct above), it knocks the initialization off this optimized path, and we end up with initialization like this on .NET 8:

    ; Tests.Init()
           xor       eax,eax
           mov       [rsi],rax
           mov       [rsi+8],rax
           mov       [rsi+10],rax
           mov       [rsi+18],rax
           mov       [rsi+20],rax
           mov       [rsi+28],rax
           mov       [rsi+30],rax
           mov       [rsi+38],rax
           mov       [rsi+40],rax
           mov       [rsi+48],rax
           mov       rax,rsi
           ret
    ; Total bytes of code 45

This is due to alignment requirements in order to provide necessary atomicity guarantees. But rather than giving up wholesale, [dotnet/runtime#102132](https://github.com/dotnet/runtime/pull/102132) allows the SIMD zeroing to be used for the contiguous portions that don’t contain GC references, so now on .NET 9 we get this:

    ; Tests.Init()
           xor       eax,eax
           mov       [rsi],rax
           vxorps    xmm0,xmm0,xmm0
           vmovdqu32 [rsi+8],zmm0
           mov       [rsi+48],rax
           mov       rax,rsi
           ret
    ; Total bytes of code 27

This optimization isn’t specific to AVX512, but it includes the ability to use AVX512 instructions when available. ([dotnet/runtime#99140](https://github.com/dotnet/runtime/pull/99140) provides similar support for Arm64.)

Other optimizations improve the JIT’s ability to select AVX512 instructions as part of generating code. One neat example of this is [dotnet/runtime#91227](https://github.com/dotnet/runtime/pull/91227) from [@Ruihan-Yin](https://github.com/Ruihan-Yin), which utilizes the cool `vpternlog` (Bitwise Ternary Logic) instruction. Imagine you have three `bool`s (`a`, `b`, and `c`), and you want to perform a series of Boolean operations on them, e.g. `a ? (b ^ c) : (b & c)`. If you were to naively compile that down, you’d end up with branches. We could make it branchless by distributing the `a` to both sides of the ternary, e.g. `(a & (b ^ c)) | (!a & (b & c))`, but now we’ve gone from one branch and one Boolean operation to six Boolean operations. What if instead we could do all of that in a single instruction _and_ do it for all of the lanes in a vector at the same time so it could be applied to multiple values as part of a SIMD operation? That’d be cool, right? That’s what `vpternlog` enables. Try running this:

    // dotnet run -c Release -f net9.0
    
    internal class Program
    {
        private static bool Exp(bool a, bool b, bool c) => (a & (b ^ c)) | (!a & b & c);
    
        private static void Main()
        {
            Console.WriteLine("a b c result");
            Console.WriteLine("------------");
            int control = 0;
            foreach (var (a, b, c, result) in from a in new[] { true, false }
                                              from b in new[] { true, false }
                                              from c in new[] { true, false }
                                              select (a, b, c, Exp(a, b, c)))
            {
                Console.WriteLine($"{Convert.ToInt32(a)} {Convert.ToInt32(b)} {Convert.ToInt32(c)} {Convert.ToInt32(result)}");
                control = control << 1 | Convert.ToInt32(result);
            }
            Console.WriteLine("------------");
            Console.WriteLine($"Control: {control:b8} == 0x{control:X2}");
        }
    }

Here we’ve put our Boolean operation into an `Exp` function, which is then being invoked for all 8 possible combinations of inputs (each of the three `bool`s each having two possible values). We’re then printing out the resulting “truth table,” that details the Boolean output for each possible input. With this particular Boolean expression, that yields this truth table being output:

    a b c result
    ------------
    1 1 1 0
    1 1 0 1
    1 0 1 1
    1 0 0 0
    0 1 1 1
    0 1 0 0
    0 0 1 0
    0 0 0 0
    ------------

We then take that last `result` column and we treat it as a binary number:

    Control: 01101000 == 0x68

So the values are `0 1 1 0 1 0 0 0`, which we read as the binary `0b01101000`, which is `0x68`. That byte is used as a “control code” to the `vpternlog` instruction to encode which of the 256 possible truth tables that exist for any possible (deterministic) Boolean combination of those inputs is being chosen. This PR then teaches the JIT how to analyze the tree structures produced by the JIT to recognize such sequences of Boolean operations, compute the control code, and substitute in the use of the better instruction. Of course, the JIT isn’t going to do the enumeration I did above; turns out there’s a more efficient way to compute the control code, performing the same sequence of operations but on specific byte values instead of Booleans, e.g. this:

    // dotnet run -c Release -f net9.0
    
    Console.WriteLine($"0x{Exp(0xF0, 0xCC, 0xAA):X2}");
    static int Exp(int a, int b, int c) => (a & (b ^ c)) | (~a & b & c);

also yields:

    0x68

Why those specific three values of `0xF0`, `0xCC`, and `0xAA`? Let’s expand them from hex to binary: `0b11110000`, `0b11001100`, `0b10101010`. Look familiar? They’re the columns for `a`, `b`, and `c` in the earlier truth table, so we’re really just running this expression over each of the 8 rows in the table at the same time. Fun.

Another neat example is in [dotnet/runtime#92017](https://github.com/dotnet/runtime/pull/92017) from [@Ruihan-Yin](https://github.com/Ruihan-Yin), which optimizes 512-bit vector constants via `broadcast`. “broadcast” is a fancy way of saying “replicate,” or “copy to each.” The instruction is used to take a single value and duplicate it to be used for each element of a vector. If, for example, I write:

    Vector512<int> vector = Vector512.Create(42);

that’s broadcasting the single value `42`, replicating it 16 times to fill up the 512-bit vector. Now imagine I have the following C# code, which is creating a `Vector512<byte>` composed of the byte sequence for the hex digits, but manually replicated four times, to fill up the 64 bytes that compose a 512-bit vector.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Runtime.Intrinsics;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        public Vector512<byte> HexLookupTable() =>
            Vector512.Create("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"u8);
    }

This would result in that whole byte sequence being stored in the assembly data section, and then the JIT would emit the code to load that data into the appropriate registers; no broadcasting. But instead, the JIT should be able to recognize that this is actually the same 16-byte sequence repeated four times, store the sequence once, and then use a `broadcast` to load and replicate that value to fill out the vector. With this PR, that’s exactly what happens.

    // .NET 8
    ; Tests.HexLookupTable()
           push      rax
           vzeroupper
           vmovups   zmm0,[7FB205399700]
           vmovups   [rsi],zmm0
           mov       rax,rsi
           vzeroupper
           add       rsp,8
           ret
    ; Total bytes of code 31
    
    // .NET 9
    ; Tests.HexLookupTable()
           push      rax
           vbroadcasti32x4 zmm0,xmmword ptr [7F78F75290F0]
           vmovups   [rsi],zmm0
           mov       rax,rsi
           vzeroupper
           add       rsp,8
           ret
    ; Total bytes of code 28

This is beneficial for a variety of reasons, including less data to store, less data to load, and if the register containing this state needed to be spilled (meaning something else needs to be put into the register, so the value currently in the register is temporarily stored in memory), reloading it is similarly cheaper.

Two of the more far-reaching changes related to AVX512, though, come from [dotnet/runtime#97675](https://github.com/dotnet/runtime/pull/97675) and [dotnet/runtime#101886](https://github.com/dotnet/runtime/pull/101886), which do the work to enable the JIT to utilize AVX512 “embedded masking.” Masking is a commonly needed solution when writing SIMD code; anywhere you see a `ConditionalSelect`, that’s masking. Consider again a ternary operation, e.g. `a ? (b + c) : (b - c)`. Here, `a` would be considered the “mask”: anywhere it’s true, the value of `b + c` is used, and anywhere it’s false, the value of `b - c` is used. If each of these were `Vector512<byte>`, for example, it would look like this in C#:

    public static Vector512<byte> Exp(Vector512<byte> a, Vector512<byte> b, Vector512<byte> c) =>
        Vector512.ConditionalSelect(a, b + c, b - c);

And guess what I’d get for assembly? You guessed it, our good friend `vpternlogd`:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Runtime.CompilerServices;
    using System.Runtime.Intrinsics;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        public Vector512<byte> Test() => Exp(default, default, default);
    
        [MethodImpl(MethodImplOptions.NoInlining)]
        public static Vector512<byte> Exp(Vector512<byte> a, Vector512<byte> b, Vector512<byte> c) =>
            Vector512.ConditionalSelect(a, b + c, b - c);
    }

    ; Tests.Exp(System.Runtime.Intrinsics.Vector512`1<Byte>, System.Runtime.Intrinsics.Vector512`1<Byte>, System.Runtime.Intrinsics.Vector512`1<Byte>)
           vzeroupper
           vmovups   zmm0,[rsp+48]
           vmovups   zmm1,[rsp+88]
           vpaddb    zmm2,zmm0,zmm1
           vpsubb    zmm0,zmm0,zmm1
           vmovups   zmm1,[rsp+8]
           vpternlogd zmm1,zmm2,zmm0,0CA
           vmovups   [rdi],zmm1
           mov       rax,rdi
           vzeroupper
           ret
    ; Total bytes of code 68

We can see it’s computing both the `b + c` (`vpaddb zmm2,zmm0,zmm1`) and the `b - c` (`vpsubb zmm0,zmm0,zmm1`), and it’s then choosing between them based on the mask (`[rsp+8]`, aka the `a` parameter). In this example, the mask `a` was being passed in and computed in a manner unknown to the `ConditionalSelect`. A more common scheme, however, is that the mask is computed as an argument to the `ConditionalSelect`. Let’s say for example that instead of passing in `a` as a mask, we pass in `Vector512.LessThan(b, c)` as the mask:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Runtime.CompilerServices;
    using System.Runtime.Intrinsics;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        public Vector512<byte> Test() => Exp(default, default);
    
        [MethodImpl(MethodImplOptions.NoInlining)]
        public static Vector512<byte> Exp(Vector512<byte> b, Vector512<byte> c) =>
            Vector512.ConditionalSelect(Vector512.LessThan(b, c), b + c, b - c);
    }

AVX512 supports this implicitly via embedded masking, which means that instructions can include the masking operation as part of them rather than performing the operation separately and then doing the masking via `vpternlogd`. Instructions like the comparison operation employed by `LessThan` can target storing the result into a new kind of register defined by AVX512, a mask register, and then that mask register can be used as part of other compound operations to incorporate the mask into them. .NET developers don’t need to do anything to take advantage of this support, though: the JIT just uses the specialized masking instructions where it sees an opportunity to do so. For the previous example, on .NET 8, we’d get this:

    ; Tests.Exp(System.Runtime.Intrinsics.Vector512`1<Byte>, System.Runtime.Intrinsics.Vector512`1<Byte>)
           vzeroupper
           vmovups   zmm0,[rsp+8]
           vmovups   zmm1,[rsp+48]
           vpcmpltub k1,zmm0,zmm1
           vpmovm2b  zmm2,k1
           vpaddb    zmm3,zmm0,zmm1
           vpsubb    zmm0,zmm0,zmm1
           vpternlogd zmm2,zmm3,zmm0,0CA
           vmovups   [rdi],zmm2
           mov       rax,rdi
           vzeroupper
           ret
    ; Total bytes of code 70

Here we still have a `vpternlogd`. But, with the aforementioned PRs, now here’s what we get on .NET 9:

    ; Tests.Exp(System.Runtime.Intrinsics.Vector512`1<Byte>, System.Runtime.Intrinsics.Vector512`1<Byte>)
           vmovups   zmm0,[rsp+8]
           vmovups   zmm1,[rsp+48]
           vpcmpltub k1,zmm0,zmm1
           vpsubb    zmm2,zmm0,zmm1
           vpaddb    zmm2{k1},zmm0,zmm1
           vmovups   [rdi],zmm2
           mov       rax,rdi
           vzeroupper
           ret
    ; Total bytes of code 54

That `vpcmpltub` instruction is doing the `LessThan` between `b` and `c` and storing the result as a mask in the `k1` masking register. The `vpsubb`for the `b - c` still happens as it did before. But now the `b + c` operation is significantly different, and note there’s no `vpternlogd` anymore. The `vpternlogd` and the `vpaddb` we previously saw have now effectively been folded into a single `vpaddb` instruction _with_ the mask. The result of the `b - c` is sitting in the `zmm2` register. The `vpaddb` instruction then performs the addition between `zmm0` (`b`) and `zmm1` (`c`), and uses the mask `k1` to decide whether to use that addition result or the existing subtraction result in `zmm2`. ([dotnet/runtime#97468](https://github.com/dotnet/runtime/pull/97468) also enables some such usage of `vpternlogd` to instead use `vblendmps`. `vblendmps` is similar to `vpternlogd` except that it’s specific to floating-point and works with one of the dedicated mask registers.)

[dotnet/runtime#97529](https://github.com/dotnet/runtime/pull/97529) also improved casting from `double` and `float` to integer types, in particular when AVX512 is available such that it can benefit from dedicated AVX512 instructions for the purpose, e.g. the `VCVTTSD2USI` (Convert With Truncation Scalar Double Precision Floating-Point Value to Unsigned Integer) instruction.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Linq;
     
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
     
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private double[] _doubles = Enumerable.Range(0, 1024).Select(i => (double)i).ToArray();
        private ulong[] _ulongs = new ulong[1024];
     
        [Benchmark]
        public void DoubleToUlong()
        {
            ReadOnlySpan doubles = _doubles;
            Span ulongs = _ulongs;
            for (int i = 0; i < doubles.Length; i++)
            {
                ulongs[i] = (ulong)doubles[i];
            }
        }
    }

Method

Runtime

Mean

Ratio

Code Size

DoubleToUlong

.NET 8.0

1,386.5 ns

1.00

135 B

DoubleToUlong

.NET 9.0

461.4 ns

0.33

102 B

### Vectorization

In addition to improvements that teach the JIT about entirely new architectures, there have also been a plethora of improvements that simply help the JIT to better employ SIMD in general.

One of my favorites is [dotnet/runtime#92852](https://github.com/dotnet/runtime/pull/92852), which merges consecutive stores into a single operation. Consider wanting to implement a method like `bool.TryFormat`:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private bool _value;
        private char[] _destination = new char[10];
    
        [Benchmark]
        public bool TryFormat() => TryFormat(_destination, out _);
    
        private bool TryFormat(char[] destination, out int charsWritten)
        {
            if (_value)
            {
                if (destination.Length >= 4)
                {
                    destination[0] = 'T';
                    destination[1] = 'r';
                    destination[2] = 'u';
                    destination[3] = 'e';
                    charsWritten = 4;
                    return true;
    
                }
            }
            else
            {
                if (destination.Length >= 5)
                {
                    destination[0] = 'F';
                    destination[1] = 'a';
                    destination[2] = 'l';
                    destination[3] = 's';
                    destination[4] = 'e';
                    charsWritten = 5;
                    return true;
                }
            }
    
            charsWritten = 0;
            return false;
        }
    }

Pretty simple: we’re writing out each individual value. That’s a bit unfortunate, though, in that we’re naively then spending several `mov`s to write each character individually, when instead we could pack all of those values into a single value to write. In fact, that’s exactly what the real `bool.TryFormat` does. Here is its handling of the `true` case today:

    if (destination.Length > 3)
    {
        ulong true_val = BitConverter.IsLittleEndian ? 0x65007500720054ul : 0x54007200750065ul; // "True"
        MemoryMarshal.Write(MemoryMarshal.AsBytes(destination), in true_val);
        charsWritten = 4;
        return true;
    }

The developer has manually done the work of computing the value of the merged writes, e.g.

    ulong true_val = (((ulong)'e' << 48) | ((ulong)'u' << 32) | ((ulong)'r' << 16) | (ulong)'T')
    Assert.Equal(0x65007500720054ul, true_val);

in order to be able to perform a single write rather than doing four individual ones. For this particular case, now in .NET 9, the JIT can automatically do this merging so the developer doesn’t have to. The developer just writes the code that’s natural to write, and the JIT does the heavy lifting of optimizing its output (note below the `mov rax, 65007500720054` instruction, loading the same value we manually computed above).

    // .NET 8
    ; Tests.TryFormat(Char[], Int32 ByRef)
           push      rbp
           mov       rbp,rsp
           cmp       byte ptr [rdi+10],0
           jne       short M01_L01
           mov       ecx,[rsi+8]
           cmp       ecx,5
           jl        short M01_L00
           mov       word ptr [rsi+10],46
           mov       word ptr [rsi+12],61
           mov       word ptr [rsi+14],6C
           mov       word ptr [rsi+16],73
           mov       word ptr [rsi+18],65
           mov       dword ptr [rdx],5
           mov       eax,1
           pop       rbp
           ret
    M01_L00:
           xor       eax,eax
           mov       [rdx],eax
           pop       rbp
           ret
    M01_L01:
           mov       ecx,[rsi+8]
           cmp       ecx,4
           jl        short M01_L00
           mov       word ptr [rsi+10],54
           mov       word ptr [rsi+12],72
           mov       word ptr [rsi+14],75
           mov       word ptr [rsi+16],65
           mov       dword ptr [rdx],4
           mov       eax,1
           pop       rbp
           ret
    ; Total bytes of code 112
    
    // .NET 9
    ; Tests.TryFormat(Char[], Int32 ByRef)
           push      rbp
           mov       rbp,rsp
           cmp       byte ptr [rdi+10],0
           jne       short M01_L00
           mov       ecx,[rsi+8]
           cmp       ecx,5
           jl        short M01_L01
           mov       rax,73006C00610046
           mov       [rsi+10],rax
           mov       word ptr [rsi+18],65
           mov       dword ptr [rdx],5
           mov       eax,1
           pop       rbp
           ret
    M01_L00:
           mov       ecx,[rsi+8]
           cmp       ecx,4
           jl        short M01_L01
           mov       rax,65007500720054
           mov       [rsi+10],rax
           mov       dword ptr [rdx],4
           mov       eax,1
           pop       rbp
           ret
    M01_L01:
           xor       eax,eax
           mov       [rdx],eax
           pop       rbp
           ret
    ; Total bytes of code 92

[dotnet/runtime#92939](https://github.com/dotnet/runtime/pull/92939) improves this further by enabling longer sequences to similarly be merged using SIMD instructions.

Of course, you may then wonder, why wasn’t `bool.TryFormat` reverted to use the simpler code? The unfortunate answer is that this optimization only currently applies to array targets rather than span targets. That’s because there are alignment requirements for performing these kinds of writes, and whereas the JIT can make certain assumptions about the alignment of arrays, it can’t make those same assumptions about spans, which can represent slices of something else at unaligned boundaries. This is now one of the few cases where arrays are better than spans; typically span is as good or better. But I’m hopeful it will be improved in the future.

Another nice improvement is [dotnet/runtime#86811](https://github.com/dotnet/runtime/pull/86811) from [@BladeWise](https://github.com/BladeWise), which adds SIMD support for multiplying two vectors of `byte`s or `sbyte`s. Previously this would end up falling back to a software implementation, which is very slow compared to true SIMD operations. Now, the code is much faster and much more compact.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Runtime.Intrinsics;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private Vector128<byte> _v1 = Vector128.Create((byte)0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15);
    
        [Benchmark]
        public Vector128<byte> Square() => _v1 * _v1;
    }

Method

Runtime

Mean

Ratio

Square

.NET 8.0

15.4731 ns

1.000

Square

.NET 9.0

0.0284 ns

0.002

[dotnet/runtime#103555](https://github.com/dotnet/runtime/pull/103555) (x64, when AVX512 isn’t available) and [dotnet/runtime#104177](https://github.com/dotnet/runtime/pull/104177) (Arm64) also improve vector multiplication, this time for `long`/`ulong`. This can be seen with a simple micro-benchmark (and because I’m running on a machine that supports AVX512, the benchmark is explicitly disabling it):

    // dotnet run -c Release -f net8.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Configs;
    using BenchmarkDotNet.Jobs;
    using BenchmarkDotNet.Environments;
    using BenchmarkDotNet.Running;
    using System.Runtime.Intrinsics;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args, DefaultConfig.Instance
        .AddJob(Job.Default.WithId(".NET 8").WithRuntime(CoreRuntime.Core80).WithEnvironmentVariable("DOTNET_EnableAVX512F", "0").AsBaseline())
        .AddJob(Job.Default.WithId(".NET 9").WithRuntime(CoreRuntime.Core90).WithEnvironmentVariable("DOTNET_EnableAVX512F", "0")));
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private Vector256<long> _a = Vector256.Create(1, 2, 3, 4);
        private Vector256<long> _b = Vector256.Create(5, 6, 7, 8);
    
        [Benchmark]
        public Vector256<long> Multiply() => Vector256.Multiply(_a, _b);
    }

Method

Runtime

Mean

Ratio

Multiply

.NET 8.0

9.5448 ns

1.00

Multiply

.NET 9.0

0.3868 ns

0.04

It’s also evident, however, on higher-level benchmarks, for example on this benchmark for `XxHash128`, an implementation that makes heavy use of multiplication of such vectors.

    // Add a <PackageReference Include="System.IO.Hashing" Version="8.0.0" /> to the csproj.
    // dotnet run -c Release -f net8.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using BenchmarkDotNet.Configs;
    using BenchmarkDotNet.Jobs;
    using BenchmarkDotNet.Environments;
    using System.IO.Hashing;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args, DefaultConfig.Instance
        .AddJob(Job.Default.WithId(".NET 8").WithRuntime(CoreRuntime.Core80).WithEnvironmentVariable("DOTNET_EnableAVX512F", "0").AsBaseline())
        .AddJob(Job.Default.WithId(".NET 9").WithRuntime(CoreRuntime.Core90).WithEnvironmentVariable("DOTNET_EnableAVX512F", "0")));
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private byte[] _data;
    
        [GlobalSetup]
        public void Setup()
        {
            _data = new byte[1024 * 1024];
            new Random(42).NextBytes(_data);
        }
    
        [Benchmark]
        public UInt128 Hash() => XxHash128.HashToUInt128(_data);
    }

This benchmark references the System.IO.Hashing nuget package. Note that we’re explicitly adding in a reference to the 8.0.0 version; that means that even when running on .NET 9, we’re using the .NET 8 version of the hashing code, yet it’s still significantly faster, because of these runtime improvements.

Method

Runtime

Mean

Ratio

Hash

.NET 8.0

40.49 us

1.00

Hash

.NET 9.0

26.40 us

0.65

Some other notable examples:

*   **Improved SIMD comparisons.** [dotnet/runtime#104944](https://github.com/dotnet/runtime/pull/104944) and [dotnet/runtime#104215](https://github.com/dotnet/runtime/pull/104215) improve how vector comparisons are handled.
*   **Improved ConditionalSelects.** [dotnet/runtime#104092](https://github.com/dotnet/runtime/pull/104092) from [@ezhevita](https://github.com/ezhevita) improves the generated code for `ConditionalSelect`s when the condition is a set of constants.
*   **Better Const Handling.** Certain operations are only optimized when one of their arguments is a constant, otherwise falling back to a much slower software emulation implementation. [dotnet/runtime#102827](https://github.com/dotnet/runtime/pull/102827) enables such instructions (like for shuffling) to continue to be treated as optimized operations if the non-const argument becomes a constant as part of other optimizations (like inlining).
*   **Unblocking other optimizations.** Some changes don’t themselves introduce optimizations, but instead make tweaks that enable other optimizations to do a better job. [dotnet/runtime#104517](https://github.com/dotnet/runtime/pull/104517) decomposes some bitwise operations (e.g. replacing a unified “and not” operation with an “and” and a “not”), which in turn enables other existing optimizations like common sub-expression elimination (CSE) to kick in more often. And [dotnet/runtime#104214](https://github.com/dotnet/runtime/pull/104214) normalized various negation patterns, which similarly enables other optimizations to apply in more places.

### Branching

Just like the JIT tries to elide redundant bounds checking, where it can prove the bounds check is unnecessary, it similarly does so for branching.

The ability to handle the relationships between branches is improved in .NET 9. Consider this benchmark:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        [Arguments(50)]
        public void Test(int x)
        {
            if (x > 100)
            {
                Helper(x);
            }
        }
    
        private void Helper(int x)
        {
            if (x > 10)
            {
                Console.WriteLine("Hello!");
            }
        }
    }

The `Helper` function is simple enough to be inlined, and in .NET 8 we end up with this assembly:

    ; Tests.Test(Int32)
           push      rbp
           mov       rbp,rsp
           cmp       esi,64
           jg        short M00_L01
    M00_L00:
           pop       rbp
           ret
    M00_L01:
           cmp       esi,0A
           jle       short M00_L00
           mov       rdi,7F35E44C7E18
           pop       rbp
           jmp       qword ptr [7F35E914C7C8]
    ; Total bytes of code 33

We can see in the original code that the branch within the inlined `Helper` is entirely unnecessary: we’re only there if `x` is greater than 100, so it’s definitely greater than 10, yet in the assembly code, we have both comparisons happening (notice the two `cmp`s). Now in .NET 9, thanks to [dotnet/runtime#95234](https://github.com/dotnet/runtime/pull/95234) which improves the JIT’s ability to reason about the relationship between two ranges and whether one is implied by the other, we get this instead:

    ; Tests.Test(Int32)
           cmp       esi,64
           jg        short M00_L00
           ret
    M00_L00:
           mov       rdi,7F81C120EE20
           jmp       qword ptr [7F8148626628]
    ; Total bytes of code 22

Just the one outer `cmp`. The same thing happens for the negative case: if we tweak the `x > 10` to instead be `x < 10`, we end up with this:

    // .NET 8
    ; Tests.Test(Int32)
           push      rbp
           mov       rbp,rsp
           cmp       esi,64
           jg        short M00_L01
    M00_L00:
           pop       rbp
           ret
    M00_L01:
           cmp       esi,0A
           jge       short M00_L00
           mov       rdi,7F6138428DE0
           pop       rbp
           jmp       qword ptr [7FA1DDD4C7C8]
    ; Total bytes of code 33
    
    // .NET 9
    ; Tests.Test(Int32)
           ret
    ; Total bytes of code 1

Similar to the `x > 10` case, on .NET 8 the JIT retained both branches. But on .NET 9, it recognized that not only was the inner conditional redundant, it was redundant in a way that would make it always false, which then allowed it to dead-code eliminate the body of that `if`, leaving the whole method a nop. [dotnet/runtime#94689](https://github.com/dotnet/runtime/pull/94689) makes this kind of information flow by enabling the JIT’s support for “cross-block local assertion prop”.

Another PR that eliminated some redundant branches is [dotnet/runtime#94563](https://github.com/dotnet/runtime/pull/94563), which feeds information from value numbering (a technique used to eliminate redundant expressions by giving every unique expression its own unique identifier) into the building of PHIs (a kind of node in the JIT’s intermediate representation of the code that aids in determining a variable’s value based on control flow). Consider this benchmark:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Runtime.CompilerServices;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public unsafe class Tests
    {
        [Benchmark]
        [Arguments(50)]
        public void Test(int x)
        {
            byte[] data = new byte[128];
            fixed (byte* ptr = data)
            {
                Nop(ptr);
            }
        }
    
        [MethodImpl(MethodImplOptions.NoInlining)]
        private static void Nop(byte* ptr) { }
    }

This is allocating a `byte[]` and then pinning it in order to use it with a method that requires a pointer. The C# specification for `fixed` width arrays states “If the array expression is `null` or if the array has zero elements, the initializer computes an address equal to zero,” and as such if you look at the IL for this code, you’ll see that it’s checking the length and setting the pointer equal to 0 if the length is 0. You can see this same behavior explicitly implemented as well for spans if you look at `Span<T>`‘s `GetPinnableReference` implementation:

    public ref T GetPinnableReference()
    {
        ref T ret = ref Unsafe.NullRef<T>();
        if (_length != 0) ret = ref _reference;
        return ref ret;
    }

As such, there’s actually an extra branch not visible in the `Tests.Test` test. But, in this particular case, that branch is also redundant, because we can very clearly see (and the JIT should be able to as well) that the length of the array is non-0. On .NET 8, we still get that branch:

    ; Tests.Test(Int32)
           push      rbp
           sub       rsp,10
           lea       rbp,[rsp+10]
           xor       eax,eax
           mov       [rbp-8],rax
           mov       rdi,offset MT_System.Byte[]
           mov       esi,80
           call      CORINFO_HELP_NEWARR_1_VC
           mov       [rbp-8],rax
           mov       rdi,[rbp-8]
           cmp       dword ptr [rdi+8],0
           je        short M00_L01
           mov       rdi,[rbp-8]
           cmp       dword ptr [rdi+8],0
           jbe       short M00_L02
           mov       rdi,[rbp-8]
           add       rdi,10
    M00_L00:
           call      qword ptr [7F3F99B45C98]; Tests.Nop(Byte*)
           xor       eax,eax
           mov       [rbp-8],rax
           add       rsp,10
           pop       rbp
           ret
    M00_L01:
           xor       edi,edi
           jmp       short M00_L00
    M00_L02:
           call      CORINFO_HELP_RNGCHKFAIL
           int       3
    ; Total bytes of code 96

But now on .NET 9, that branch (in fact, multiple redundant branches) is removed:

    ; Tests.Test(Int32)
           push      rax
           xor       eax,eax
           mov       [rsp],rax
           mov       rdi,offset MT_System.Byte[]
           mov       esi,80
           call      CORINFO_HELP_NEWARR_1_VC
           mov       [rsp],rax
           add       rax,10
           mov       rdi,rax
           call      qword ptr [7F22DAC844C8]; Tests.Nop(Byte*)
           xor       eax,eax
           mov       [rsp],rax
           add       rsp,8
           ret
    ; Total bytes of code 55

[dotnet/runtime#87656](https://github.com/dotnet/runtime/pull/87656) is another nice example and addition to the JIT’s optimization repertoire. As was discussed earlier, branches have costs associated with them. A hardware’s branch predictor can often do a very good job of mitigating the bulk of those costs, but there’s still some, and even if it were fully mitigated in the common case, a branch prediction failure can be relatively very costly. As such, minimizing branches can be very helpful, and if nothing else, turning branch-based operations into branchless ones leads to more consistent and predictable throughput, as it’s then less subject to the nature of the data being processed. Consider the following function that’s used to determine whether a character is a particular subset of whitespace characters:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        [Arguments('s')]
        public bool IsJsonWhitespace(int c)
        {
            if (c == ' ' || c == '\t' || c == '\r' || c == '\n')
            {
                return true;
            }
    
            return false;
        }
    }

On .NET 8, we get what you’d probably expect, a series of `cmp`s followed by conditional jumps, one for each character:

    ; Tests.IsJsonWhitespace(Int32)
           push      rbp
           mov       rbp,rsp
           cmp       esi,20
           je        short M00_L00
           cmp       esi,9
           je        short M00_L00
           cmp       esi,0D
           je        short M00_L00
           cmp       esi,0A
           je        short M00_L00
           xor       eax,eax
           pop       rbp
           ret
    M00_L00:
           mov       eax,1
           pop       rbp
           ret
    ; Total bytes of code 35

On .NET 9, though, we now get this:

    ; Tests.IsJsonWhitespace(Int32)
           push      rbp
           mov       rbp,rsp
           cmp       esi,20
           ja        short M00_L00
           mov       eax,0FFFFD9FF
           bt        rax,rsi
           jae       short M00_L01
    M00_L00:
           xor       eax,eax
           pop       rbp
           ret
    M00_L01:
           mov       eax,1
           pop       rbp
           ret
    ; Total bytes of code 31

It’s now using a `bt` instruction (a bit test) against a pattern where there’s a bit set for each of the characters being tested against, consolidating most of the branches down to just this one.

Unfortunately, this also highlights that such optimizations, which are looking for a particular pattern, can get knocked off their golden path, at which point the optimization won’t kick in. In this case, there are several ways it can get knocked off. The most obvious is if there are too many values or if they’re too spread out, such that they can’t fit into the 32-bit or 64-bit bit mask. More interesting, if you switch it to instead use C# pattern matching (e.g. `c is ' ' or '\t' or '\r' or '\n'`), it also doesn’t kick in. Why? Because the C# compiler itself is trying to optimize, and the pattern it ends up generating in the IL is different from what this optimization is expecting. I expect this’ll get better in the future, but it’s a good reminder that these kinds of optimizations are useful when they make arbitrary code better, but if you’re coding to the exact nature of the optimization and relying on it happening, you really need to be paying attention.

A related optimization was added in [dotnet/runtime#93521](https://github.com/dotnet/runtime/pull/93521). Consider a function like the following, which is checking to see whether a character is a lower-case hexadecimal char:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        [Arguments('s')]
        public bool IsHexLower(char c)
        {
            if ((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))
            {
                return true;
            }
    
            return false;
        }
    }

On .NET 8, we get a comparison against `'0'`, a comparison again `'9'`, a comparison against `'a'`, and a comparison against `'f'`, with a conditional branch for each:

    ; Tests.IsHexLower(Char)
           push      rbp
           mov       rbp,rsp
           movzx     eax,si
           cmp       eax,30
           jl        short M00_L00
           cmp       eax,39
           jle       short M00_L02
    M00_L00:
           cmp       eax,61
           jl        short M00_L01
           cmp       eax,66
           jle       short M00_L02
    M00_L01:
           xor       eax,eax
           pop       rbp
           ret
    M00_L02:
           mov       eax,1
           pop       rbp
           ret
    ; Total bytes of code 38

But on .NET 9, we instead get this:

    ; Tests.IsHexLower(Char)
           push      rbp
           mov       rbp,rsp
           movzx     eax,si
           mov       ecx,eax
           sub       ecx,30
           cmp       ecx,9
           jbe       short M00_L00
           sub       eax,61
           cmp       eax,5
           jbe       short M00_L00
           xor       eax,eax
           pop       rbp
           ret
    M00_L00:
           mov       eax,1
           pop       rbp
           ret
    ; Total bytes of code 36

Effectively the JIT has rewritten the condition as if I’d written it like this:

    (((uint)c - '0') <= ('9' - '0')) || (((uint)c - 'a') <= ('f' - 'a'))

which is nice, because it’s replaced two of the conditional branches with two (cheaper) subtractions.

### Write Barriers

The .NET garbage collector (GC) is a generational collector. That means it divides the heap up logically by object age, where “generation 0” (or “gen0”) are the newest objects that haven’t been around for very long, “gen2” are the objects that have been around for a while, and “gen1” are in the middle. This approach is based on the theory (that also generally plays out in practice) that most objects end up being very short-lived, created for some task and then quickly dropped, and conversely that if an object has been around for a while, there’s a really good chance it’ll continue to be around for a while. By partitioning up objects like this, the GC can reduce the amount of work it needs to do when it scans for objects to be collected. It can do a scan focused only on gen0 objects, allowing it to ignore anything in gen1 or gen2 and thereby make its scan much faster. Or at least, that’s the goal. If it were to only scan gen0 objects, though, it could easily think a gen0 object wasn’t referenced because it couldn’t find any references to one from other gen0 objects… but there may have been a reference from a gen1 or gen2 object. That would be bad. How does the GC deal with this then, having its cake and eating it, too? It colludes with the rest of the runtime to track any time its generational assumptions might be violated. The GC maintains a table (called the “card table”) that indicates whether an object in a higher generation _might_ contain a reference to a lower generation object, and any time a reference is written such that there could end up being a reference from a higher generation to a lower one, this table is updated. Then when the GC does its scan, it only needs to examine higher generation objects if the relevant bit in the table is set (the table doesn’t track individual objects, just ranges of them, so it’s similar to a [“Bloom filter”](https://en.wikipedia.org/wiki/Bloom_filter), where the lack of a bit means there’s definitely not a reference but the presence of a bit only means there _might_ be a reference).

The code that’s executed to track the reference write and possibly update the card table is referred to as a GC write barrier. And, obviously, if that code is happening every time a reference is written to an object, you really, really, really want that code to be efficient. There are actually multiple different forms of GC write barriers, all specialized for slightly different purposes.

The standard GC write barrier is `CORINFO_HELP_ASSIGN_REF`. However, there’s another one called `CORINFO_HELP_CHECKED_ASSIGN_REF` that needs to do a bit more work. The JIT is the one deciding which of these to use, and it uses the latter when it’s possible the target isn’t on the heap, in which case the barrier needs to do a little more work to figure that out.

[dotnet/runtime#98166](https://github.com/dotnet/runtime/pull/98166) helps the JIT do better in a certain case. If you have a static field of a value type:

    static SomeStruct s_someField;
    ...
    struct SomeStruct
    {
        public object Obj;
    }

the runtime implements that by having a box associated with that field for storing that struct. Such static boxes are always on the heap, so if you then do:

    static void Store(object o) => s_someField.Obj = o;

the JIT can prove that the cheaper unchecked write barrier may be used, and this PR teaches it that. Previously sometimes the JIT would be able to figure it out, but this effectively ensures it.

Another similar improvement comes from [dotnet/runtime#97953](https://github.com/dotnet/runtime/pull/97953). Here’s an example based on `ConcurrentQueue<T>`, which maintains arrays of elements, each of which is the actual item tagged with a sequence number that’s used by the implementation to maintain correctness in the face of concurrency.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private Slot<object>[] _arr = new Slot<object>[1];
        private object _obj = new object();
    
        [Benchmark]
        public void Test() => Store(_arr, _obj);
    
        private static void Store<T>(Slot<T>[] arr, T o)
        {
            arr[0].Item = o;
            arr[0].SequenceNumber = 1;
        }
    
        private struct Slot<T>
        {
            public T Item;
            public int SequenceNumber;
        }
    }

Here as well we can see on .NET 8 it’s using the more expensive checked write barrier, but on .NET 9 the JIT has recognized it can use the cheaper unchecked write barrier:

    // .NET 8
    ; Tests.Test()
           push      rbx
           mov       rbx,[rdi+8]
           mov       rsi,[rdi+10]
           cmp       dword ptr [rbx+8],0
           jbe       short M00_L00
           add       rbx,10
           mov       rdi,rbx
           call      CORINFO_HELP_CHECKED_ASSIGN_REF
           mov       dword ptr [rbx+8],1
           pop       rbx
           ret
    M00_L00:
           call      CORINFO_HELP_RNGCHKFAIL
           int       3
    ; Total bytes of code 42
    
    // .NET 9
    ; Tests.Test()
           push      rbx
           mov       rbx,[rdi+8]
           mov       rsi,[rdi+10]
           cmp       dword ptr [rbx+8],0
           jbe       short M00_L00
           add       rbx,10
           mov       rdi,rbx
           call      CORINFO_HELP_ASSIGN_REF
           mov       dword ptr [rbx+8],1
           pop       rbx
           ret
    M00_L00:
           call      CORINFO_HELP_RNGCHKFAIL
           int       3
    ; Total bytes of code 42

[dotnet/runtime#101761](https://github.com/dotnet/runtime/pull/101761) actually introduces a new form of write barrier. Consider this:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private MyStruct _value;
        private Wrapper _wrapper = new();
    
        [Benchmark]
        public void Store() => _wrapper.Value = _value;
    
        private record struct MyStruct(string a1, string a2, string a3, string a4);
    
        private class Wrapper
        {
            public MyStruct Value;
        }
    }

Previously as part of copying that struct, each of those fields (represented by `a1` through `a4`) would individually incur a write barrier:

    ; Tests.Store()
           push      rax
           mov       [rsp],rdi
           mov       rax,[rdi+8]
           lea       rdi,[rax+8]
           mov       rsi,[rsp]
           add       rsi,10
           call      CORINFO_HELP_ASSIGN_BYREF
           call      CORINFO_HELP_ASSIGN_BYREF
           call      CORINFO_HELP_ASSIGN_BYREF
           call      CORINFO_HELP_ASSIGN_BYREF
           nop
           add       rsp,8
           ret
    ; Total bytes of code 47

Now in .NET 9, this PR added a new bulk write barrier, which can implement the operation more efficiently.

    ; Tests.Store()
           push      rax
           mov       rsi,[rdi+8]
           add       rsi,8
           cmp       [rsi],sil
           add       rdi,10
           mov       [rsp],rdi
           cmp       [rdi],dil
           mov       rdi,rsi
           mov       rsi,[rsp]
           mov       edx,20
           call      qword ptr [7F5831BC5740]; System.Buffer.BulkMoveWithWriteBarrier(Byte ByRef, Byte ByRef, UIntPtr)
           nop
           add       rsp,8
           ret
    ; Total bytes of code 47

Making GC write barriers faster is good; after all, they’re used _a lot_. However, switching from the checked write barrier to the non-checked write barrier is a very micro optimization; the extra overhead of the checked variant is often just a couple of comparisons. A better optimization is avoiding the need for a barrier entirely! [dotnet/runtime#103503](https://github.com/dotnet/runtime/pull/103503) recognizes that `ref struct`s can’t possibly be on the GC heap by their very nature, and as such, write barriers can be entirely elided when writing into the fields of a `ref struct`.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Runtime.CompilerServices;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        public void Store()
        {
            MyRefStruct s = default;
            Test(ref s, new object(), new object());
        }
    
        [MethodImpl(MethodImplOptions.NoInlining)]
        private void Test(ref MyRefStruct s, object o1, object o2)
        {
            s.Obj1 = o1;
            s.Obj2 = o2;
        }
    
        private ref struct MyRefStruct
        {
            public object Obj1;
            public object Obj2;
        }
    }

On .NET 8, we have two barriers; on .NET 9, zero:

    // .NET 8
    ; Tests.Test(MyRefStruct ByRef, System.Object, System.Object)
           push      r15
           push      rbx
           mov       rbx,rsi
           mov       r15,rcx
           mov       rdi,rbx
           mov       rsi,rdx
           call      CORINFO_HELP_CHECKED_ASSIGN_REF
           lea       rdi,[rbx+8]
           mov       rsi,r15
           call      CORINFO_HELP_CHECKED_ASSIGN_REF
           nop
           pop       rbx
           pop       r15
           ret
    ; Total bytes of code 37
    
    // .NET 9
    ; Tests.Test(MyRefStruct ByRef, System.Object, System.Object)
           mov       [rsi],rdx
           mov       [rsi+8],rcx
           ret
    ; Total bytes of code 8

Similarly, [dotnet/runtime#102084](https://github.com/dotnet/runtime/pull/102084) is able to remove some barriers on Arm64 as part of `ref struct` copies.

### Object Stack Allocation

For years, .NET has explored the possibility of stack-allocating managed objects. It’s something that other managed languages like Java are already capable of doing, but it’s also more critical in Java, which lacks the equivalent of value types (e.g. if you want a list of integers, that’d most likely be `List<Integer>`, which will box each integer value added to the list, similar to if `List<object>` were used in .NET). In .NET 9, object stack allocation starts to happen. Before you get too excited, it’s limited in scope right now, but in the future it’s likely to expand out further.

The hardest part of stack allocating objects is ensuring that it’s safe. If a reference to the object were to escape and end up being stored somewhere that outlived the stack frame containing the stack-allocated object, that would be very bad; when the method returned, those outstanding references would be pointing to garbage. So, the JIT needs to perform escape analysis to ensure that never happens, and doing that well is extremely challenging. For .NET 9, the support was introduced in [dotnet/runtime#103361](https://github.com/dotnet/runtime/pull/103361) (and brought to Native AOT in [dotnet/runtime#104411](https://github.com/dotnet/runtime/pull/104411)), and it doesn’t do any interprocedural analysis, which means it’s limited to only handling cases where it can easily prove the object reference doesn’t leave the current frame. Even so, there are plenty of situations where this will help to eliminate allocations, and I expect it’ll be expanded to handle more and more cases in the future. When the JIT does choose to allocate an object on the stack, it effectively promotes the fields of the object to be individual variables in the stack frame.

Here’s a very simple example of the mechanism in action:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        public int GetValue() => new MyObj(42).Value;
    
        private class MyObj
        {
            public MyObj(int value) => Value = value;
            public int Value { get; }
        }
    }

On .NET 8, the generated code for `GetValue` looks like this:

    ; Tests.GetValue()
           push      rax
           mov       rdi,offset MT_Tests+MyObj
           call      CORINFO_HELP_NEWSFAST
           mov       dword ptr [rax+8],2A
           mov       eax,[rax+8]
           add       rsp,8
           ret
    ; Total bytes of code 31

The generated code is allocating a new object, populating that object’s `Value`, and then reading that `Value` as the value to return. On .NET 9, we instead end up with this picture of simplicity:

    ; Tests.GetValue()
           mov       eax,2A
           ret
    ; Total bytes of code 6

The JIT has inlined the constructor, inlined accesses to the `Value` property, promoted the field backing that property to be a variable, and in effect optimized the entire operation simply to be `return 42;`.

Method

Runtime

Mean

Ratio

Code Size

Allocated

Alloc Ratio

GetValue

.NET 8.0

3.6037 ns

1.00

31 B

24 B

1.00

GetValue

.NET 9.0

0.0519 ns

0.01

6 B

–

0.00

Here’s another more impactful example. When it comes to performance optimization, it’s really nice when the right things just happen; otherwise, developers need to learn the minute differences between performing an operation this way or that way. Every programming language and platform has non-trivial amounts of such things, but we really want to drive the number of them down. One interesting case for .NET has had to do with structs and casting. Consider these two `Dispose1` and `Dispose2` methods:

    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Runtime.CompilerServices;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        public void Test()
        {
            Dispose1<MyStruct>(default);
            Dispose2<MyStruct>(default);
        }
    
        [MethodImpl(MethodImplOptions.NoInlining)]
        private bool Dispose1<T>(T o)
        {
            bool disposed = false;
            if (o is IDisposable disposable)
            {
                disposable.Dispose();
                disposed = true;
            }
            return disposed;
        }
    
        [MethodImpl(MethodImplOptions.NoInlining)]
        private bool Dispose2<T>(T o)
        {
            bool disposed = false;
            if (o is IDisposable)
            {
                ((IDisposable)o).Dispose();
                disposed = true;
            }
            return disposed;
        }
    
        private struct MyStruct : IDisposable
        {
            public void Dispose() { }
        }
    }

Ideally, if you call them with a value type `T`, there wouldn’t be any allocation, but unfortunately, in `Dispose1` because of how things line up here, the JIT would end up needing to box `o` to produce the `IDisposable`. Interestingly, due to optimizations several years ago, in `Dispose2` the JIT is in fact able to elide the boxing. On .NET 8, we get this:

    ; Tests.Dispose1[[Tests+MyStruct, benchmarks]](MyStruct)
           push      rbx
           mov       rdi,offset MT_Tests+MyStruct
           call      CORINFO_HELP_NEWSFAST
           add       rax,8
           mov       ebx,[rsp+10]
           mov       [rax],bl
           mov       eax,1
           pop       rbx
           ret
    ; Total bytes of code 33
    
    ; Tests.Dispose2[[Tests+MyStruct, benchmarks]](MyStruct)
           mov       eax,1
           ret
    ; Total bytes of code 6

This is one of those things that a developer would have to “just know,” and also fight against tooling like [IDE0038](https://learn.microsoft.com/dotnet/fundamentals/code-analysis/style-rules/ide0020-ide0038) that pushes developers to write this code like in my first version, whereas for structs the latter ends up being more efficient. This work on stack allocation makes that difference go away, because the boxing that occurs as part of the first version is a quintessential example of the allocation the compiler is now able to stack allocate. On .NET 9, we now end up with this:

    ; Tests.Dispose1[[Tests+MyStruct, benchmarks]](MyStruct)
           mov       eax,1
           ret
    ; Total bytes of code 6
    
    ; Tests.Dispose2[[Tests+MyStruct, benchmarks]](MyStruct)
           mov       eax,1
           ret
    ; Total bytes of code 6

Method

Runtime

Mean

Ratio

Code Size

Allocated

Alloc Ratio

Test

.NET 8.0

5.726 ns

1.00

94 B

24 B

1.00

Test

.NET 9.0

2.095 ns

0.37

45 B

–

0.00

### Inlining

Improvements in inlining were a major focus of previous releases, and will likely be a major focus again in the future. For .NET 9, there weren’t a ton of changes, but there was one particularly impactful improvement.

As a motivating example, consider `ArgumentNullException.ThrowIfNull` again. It is defined like this:

    public static void ThrowIfNull(object? arg, [CallerArgumentExpression(nameof(arg))] string? paramName = null);

Notably, it’s non-generic, and that’s a question we get asked about at some relevant frequency. We chose not to make it generic for three reasons:

1.  The main benefit of making it generic would be to avoid boxing structs, but the JIT already eliminated said boxing in tier 1, and as was highlighted earlier in this post, it’s possible for it to eliminate it in tier 0 as well (and now does).
2.  Every generic instantiation (using a generic with a different type) adds runtime overhead. We didn’t want to bloat a process with such additional metadata and runtime data structures just to support argument validation that should rarely if ever fail in production.
3.  When used with reference types (which is its raison d’etre), it would not play well with inlining, but inlining of such a “throw helper” is critical for performance. Generic methods with coreclr and Native AOT work in one of two ways. For value types, every time a generic is used with a different value type, an entire copy of the generic method is made and specialized for that parameter type; it’s as if you wrote a dedicated version of that generic code that wasn’t generic and was instead customized specifically for that type. For reference types, there’s only one copy of the code that’s then shared across all reference types, and it’s parameterized at run-time based on the actual type being used. When you access such a shared generic, at run-time it ends up looking up in a dictionary the information about the generic argument and using the discovered information to inform the rest of the method. Historically, this has not been conducive to inlining.

So, `ThrowIfNull` is non-generic. But, there are other throw helpers, many of them are generic. That’s because a) they’re primarily expected to work with value types, and b) we had no choice, given the nature of the methods. So, for example, `ArgumentOutOfRangeException.ThrowIfEqual` is generic on `T`, accepting two values of `T` to compare and throw if they’re the same. And if `T` is a reference type, on .NET 8 it may not successfully inline if the caller is a shared generic as well. With this:

    // dotnet run -c Release -f net8.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Runtime.CompilerServices;
    
    namespace Benchmarks;
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public unsafe class Tests
    {
        private static void Main(string[] args) =>
            BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
        [Benchmark]
        public void Test() => ThrowOrDispose(new Version(1, 0), new Version(1, 1));
    
        [MethodImpl(MethodImplOptions.NoInlining)]
        private static void ThrowOrDispose<T>(T value, T invalid) where T : IEquatable<T>
        {
            ArgumentOutOfRangeException.ThrowIfEqual(value, invalid);
            if (value is IDisposable disposable)
            {
                disposable.Dispose();
            }
        }
    }

on .NET 8 we get this for the `ThrowOrDispose` method (this example benchmark has a slightly different shape from previous examples and this output is from Windows, for reasons to be made clearer shortly):

    ; Benchmarks.Tests.ThrowOrDispose[[System.__Canon, System.Private.CoreLib]](System.__Canon, System.__Canon)
           push      rsi
           push      rbx
           sub       rsp,28
           mov       [rsp+20],rcx
           mov       rbx,rdx
           mov       rsi,r8
           mov       rdx,[rcx+10]
           mov       rax,[rdx+10]
           test      rax,rax
           je        short M01_L00
           mov       rcx,rax
           jmp       short M01_L01
    M01_L00:
           mov       rdx,7FF996A8B170
           call      CORINFO_HELP_RUNTIMEHANDLE_METHOD
           mov       rcx,rax
    M01_L01:
           mov       rdx,rbx
           mov       r8,rsi
           mov       r9,1DB81B20390
           call      qword ptr [7FF996AC5BC0]; System.ArgumentOutOfRangeException.ThrowIfEqual[[System.__Canon, System.Private.CoreLib]](System.__Canon, System.__Canon, System.String)
           mov       rdx,rbx
           mov       rcx,offset MT_System.IDisposable
           call      qword ptr [7FF996664348]; System.Runtime.CompilerServices.CastHelpers.IsInstanceOfInterface(Void*, System.Object)
           test      rax,rax
           jne       short M01_L03
    M01_L02:
           add       rsp,28
           pop       rbx
           pop       rsi
           ret
    M01_L03:
           mov       rcx,rax
           mov       r11,7FF9965204F8
           call      qword ptr [r11]
           jmp       short M01_L02
    ; Total bytes of code 124

Two things in particular to notice here. First, we see there’s a `call` to `CORINFO_HELP_RUNTIMEHANDLE_METHOD`; that’s the helper being used to obtain information about the actual type `T` being used. Second, `ThrowIfEqual` is not being inlined; if that were being inlined, we wouldn’t see that `call` to `ThrowIfEqual` here but instead we’d see the actual code for `ThrowIfEqual`. We can confirm why it’s not being inlined via another BenchmarkDotNet diagnoser: `[InliningDiagnoser]`. The JIT is capable of emitting events for much of its activity, including reporting on any successful or failed inlining operations, and `[InliningDiagnoser]` listens to those events and reports them as part of the benchmarking results. This particular diagnoser is in a separate `BenchmarkDotNet.Diagnostics.Windows` package and only works today when running on Windows, because it relies on ETW, hence for comparison why I made the previous benchmark also be Windows. When I add:

    [InliningDiagnoser(allowedNamespaces: ["Benchmarks"])]

to my `Tests` class, and run the benchmarks for .NET 8:

    // Add a <PackageReference Include="BenchmarkDotNet.Diagnostics.Windows" Version="9.0.0" /> to the csproj.
    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Diagnostics.Windows.Configs;
    using BenchmarkDotNet.Running;
    using System.Runtime.CompilerServices;
    
    namespace Benchmarks;
    
    [InliningDiagnoser(allowedNamespaces: ["Benchmarks"])]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private static void Main(string[] args) =>
            BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
        [Benchmark]
        public void Test() => ThrowOrDispose(new Version(1, 0), new Version(1, 1));
    
        [MethodImpl(MethodImplOptions.NoInlining)]
        private static void ThrowOrDispose<T>(T value, T invalid) where T : IEquatable<T>
        {
            ArgumentOutOfRangeException.ThrowIfEqual(value, invalid);
            if (value is IDisposable disposable)
            {
                disposable.Dispose();
            }
        }
    }

I see this as part of the output:

    Inliner: Benchmarks.Tests.ThrowOrDispose - generic void  (!!0,!!0)
    Inlinee: System.ArgumentOutOfRangeException.ThrowIfEqual - generic void  (!!0,!!0,class System.String)
    Fail Reason: runtime dictionary lookup

In other words, `ThrowOrDispose` called `ThrowIfEqual` but couldn’t inline it because `ThrowIfEqual` contained a “runtime dictionary lookup;” in other words, it’s a shared generic method.

Now on .NET 9, thanks to [dotnet/runtime#99265](https://github.com/dotnet/runtime/pull/99265), it is inlined! The resulting assembly is too large for me to show here, but we can see the impact in the benchmark results:

Method

Runtime

Mean

Ratio

Test

.NET 8.0

17.54 ns

1.00

Test

.NET 9.0

12.76 ns

0.73

and we can see it in the inlining report as successfully inlining.

GC
--

Applications end up having different needs when it comes to memory management. Would you be willing to throw more memory at maximizing throughput, or do you care more about minimizing working set? How important is it that unused memory be returned to the system aggressively? Is your expected workload constant or ebbing and flowing in nature? The GC has long had lots of knobs for configuring behavior based on these kinds of questions, but none more apparent than the choice of whether to use the “workstation GC” or “server GC”.

By default, an application uses the workstation GC, though some environments (like ASP.NET) opt-in to using server GC automatically. You can explicitly opt-in in a variety of ways, including by adding `<ServerGarbageCollection>true</ServerGarbageCollection>` into your project file (as we did in the [Benchmarking Setup](#benchmarking-setup1) section of this post). Workstation GC optimizes for reduced memory consumption, while server GC optimizes for maximum throughput. Historically, workstation employs a single heap, whereas server employs a heap per core. That typically represents a tradeoff between amount of memory consumed and the overhead of accessing a heap, such as the cost of allocating. If a bunch of threads are all trying to allocate at the same time, with server GC they’re very likely to all be accessing different heaps, thereby reducing contention, whereas with workstation GC, they’re all going to be fighting for access. Conversely, more heaps generally means more memory consumed (even though each heap could be smaller than the single one), especially in lull periods where the system might not be fully loaded, yet is paying in working set for those extra heaps.

The decision for which to use isn’t always so clear. Especially in the presence of containers, you frequently still care about really good throughput, but also don’t want to be spending memory uselessly. Enter [“DATAS,” or “Dynamically Adapting To Application Sizes”](https://maoni0.medium.com/dynamically-adapting-to-application-sizes-2d72fcb6f1ea). DATAS was introduced in .NET 8 and serves to narrow the gap between workstation and server GC, bringing server GC closer to workstation memory consumption. It dynamically scales how much memory is being consumed by server GC, such that in times of less load, less memory is being used. While DATAS shipped in .NET 8, it was only on by default for Native AOT-based projects, and even there it still had some issues to be sorted. Those issues have now been sorted (e.g. [dotnet/runtime#98743](https://github.com/dotnet/runtime/pull/98743), [dotnet/runtime#100390](https://github.com/dotnet/runtime/pull/100390), [dotnet/runtime#102368](https://github.com/dotnet/runtime/pull/102368), and [dotnet/runtime#105545](https://github.com/dotnet/runtime/pull/105545)), such that in .NET 9, as of [dotnet/runtime#103374](https://github.com/dotnet/runtime/pull/103374), DATAS is now enabled by default for server GC.

If you have a workload where absolute best possible throughput is paramount and you’re ok with additional memory being consumed to enable that, you should feel free to disable DATAS, e.g. by adding this to your project file:

    <GarbageCollectionAdaptationMode>0</GarbageCollectionAdaptationMode>

While DATAS being enabled by default is a very impactful improvement for .NET 9, there are other GC-related improvements in the release as well. For example, when compacting heaps, the GC may end up sorting objects by addresses. For large numbers of objects, this sort can be relatively expensive, and it behooves the GC to parallelize the sorting operation. For this purpose, several releases ago the GC incorporated a parallelized sorting algorithm called vxsort, which is effectively a quicksort with a parallelized partitioning step. However, it was only enabled for Windows (and only on x64). In .NET 9, it’s enabled for Linux as well as part of [dotnet/runtime#98712](https://github.com/dotnet/runtime/pull/98712). This helps to reduce GC pause times.

VM
--

The .NET runtime provides many services to managed code. There’s the GC, of course, and the JIT compiler, and then there’s a whole bunch of functionality around things like assembly and type loading, exception handling, configuration management, virtual dispatch, interop infrastructure, stub management, and so on. All of that functionality is generally referred to as being part of the coreclr virtual machine (VM).

Many performance changes in this area are hard to demonstrate, but they’re still worth mentioning. [dotnet/runtime#101580](https://github.com/dotnet/runtime/pull/101580) lazily-allocates some information related to method entrypoints, resulting in smaller heap sizes and less work on startup. [dotnet/runtime#96857](https://github.com/dotnet/runtime/pull/96857) also removed some unnecessary allocation happening related to data structures around methods. [dotnet/runtime#96703](https://github.com/dotnet/runtime/pull/96703) reduced the algorithmic complexity of some key functions involved in building up method tables, while [dotnet/runtime#96466](https://github.com/dotnet/runtime/pull/96466) streamlined access to those tables, minimizing the number of indirections involved.

Another set of changes went in to improving various calls from managed code into the VM. When managed code needs to call into the runtime, it has a couple of mechanisms it can employ. One is a “QCALL,” which is effectively just a P/Invoke / `DllImport` into functions declared in the runtime. The other is an “FCALL,” a much more specialized and complicated mechanism for invoking runtime code that’s capable of accessing managed objects. FCALL used to be the dominant mechanism, but each release more and more such calls are transitioned over to being QCALLs, which helps with both correctness (FCALLs can be hard to “get right”) and in some cases performance (some FCALLS need helper method frames that in turn typically make them more expensive than QCALLs). [dotnet/runtime#96860](https://github.com/dotnet/runtime/pull/96860) converted over members of `Marshal`, [dotnet/runtime#96916](https://github.com/dotnet/runtime/pull/96916) did so for `Interlocked`, [dotnet/runtime#96926](https://github.com/dotnet/runtime/pull/96926) handled several more threading-related members, [dotnet/runtime#97432](https://github.com/dotnet/runtime/pull/97432) converted some of the built-in marshaling support, [dotnet/runtime#97469](https://github.com/dotnet/runtime/pull/97469) and [dotnet/runtime#100939](https://github.com/dotnet/runtime/pull/100939) handled methods from `GC` and throughout reflection, [dotnet/runtime#103211](https://github.com/dotnet/runtime/pull/103211) from [@AustinWise](https://github.com/AustinWise) converted `GC.ReRegisterForFinalize`, and [dotnet/runtime#105584](https://github.com/dotnet/runtime/pull/105584) converted `Delegate.GetMulticastInvoke` (which is used in APIs like `Delegate.Combine` and `Delegate.Remove`). [dotnet/runtime#97590](https://github.com/dotnet/runtime/pull/97590) did the same for the slow path in `ValueType.GetHashCode`, while also converting the fast path to managed to avoid the transition entirely.

But arguably the most impactful change in this area for .NET 9 is around exceptions. Exceptions are expensive and should be avoided where performance matters. But… just because they’re expensive doesn’t mean it’s not valuable to make them less expensive. And in fact, there are cases where it’s really worthwhile to make them less expensive. One of the things we sporadically observe in the wild are “exception storms.” Some failure happens, which causes another failure, which causes another. Each of those incurs exceptions. CPU consumption starts to spike as the overhead of those exceptions is incurred. Now other things start to time out because they’re getting starved, and they throw exceptions, which in turn causes more failures. You get the idea.

In [Performance Improvements in .NET 8](https://devblogs.microsoft.com/dotnet/performance-improvements-in-net-8/), I highlighted that in my opinion the single most important performance improvement in the release was a single character change, enabling dynamic PGO by default. Now in .NET 9, [dotnet/runtime#98570](https://github.com/dotnet/runtime/pull/98570) is similar, a super small and simple PR that belies all the work that came before it. Earlier on, [dotnet/runtime#88034](https://github.com/dotnet/runtime/pull/88034) had ported the Native AOT exception handling implementation over to coreclr, but it was disabled by default due to still needing bake time. It’s now had that bake time, and the new implementation is now on by default in .NET 9. And it’s much faster. Things get better still with [dotnet/runtime#103076](https://github.com/dotnet/runtime/pull/103076), which removes a global spinlock involved in the handling of exceptions.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        public async Task ExceptionThrowCatch()
        {
            for (int i = 0; i < 1000; i++)
            {
                try { await Recur(10); } catch { }
            }
        }
    
        private async Task Recur(int depth)
        {
            if (depth <= 0)
            {
                await Task.Yield();
                throw new Exception();
            }
    
            await Recur(depth - 1);
        }
    }

Method

Runtime

Mean

Ratio

ExceptionThrowCatch

.NET 8.0

123.03 ms

1.00

ExceptionThrowCatch

.NET 9.0

54.68 ms

0.44

Mono
----

We frequently say “the runtime,” but in reality there are currently multiple runtime implementations in .NET. “coreclr” is the runtime thus far referred to, which is the default runtime used on Windows, Linux, and macOS, and for services and desktop applications, but there’s also “mono,” which is mainly used when the form factor of the target application requires a small runtime: by default, it’s the runtime that’s used when building mobile apps for Android and iOS today, as well as the runtime used for Blazor WASM apps. mono has also seen a multitude of performance improvements in .NET 9:

*   **Save/restoring of profile data.** One of the features provided by mono is an interpreter, which enables .NET code to execute in environments where JIT’ing isn’t permitted, as well as to enable faster startup. Specifically for when targeting WASM, the interpreter has a form of PGO where after methods have been invoked some number of times and are deemed important, it’ll generate WASM on-the-fly to optimize those methods. This tiering gets better in .NET 9 with [dotnet/runtime#92981](https://github.com/dotnet/runtime/pull/92981), which enables keeping track of which methods tiered up, and if the code is running in a browser, storing that information in the browser’s cache for subsequent runs. When the code then runs subsequently, it can incorporate the previous learnings to tier up better and more quickly.
*   **SSA-based Optimization.** The compiler that generates that WASM applied optimizations primarily at the basic block level. [dotnet/runtime#96315](https://github.com/dotnet/runtime/pull/96315) overhauls the implementation to employ Static Single Assignment (SSA) form, which is commonly used by optimizing compilers and which ensures that every variable is assigned in exactly one location. That form simplifies many resulting analyses and thus helps to better optimize the code.
*   **Vector improvements.** More and more vectorization is being done by the core libraries, utilizing hardware intrinsics and the various `Vector` types. To enable such library code to execute well on mono, the various mono backends need to also handle those operations efficiently. One of the most impactful changes here is [dotnet/runtime#105299](https://github.com/dotnet/runtime/pull/105299), which updated mono to accelerate `Shuffle` for types other than `byte` and `sbyte` (which were already handled). This is very impactful to functionality in the core libraries, many of which use `Shuffle` as part of core algorithms, like throughout `IndexOfAny`, hex encoding and decoding, Base64 encoding and decoding, `Guid`, and more. [dotnet/runtime#92714](https://github.com/dotnet/runtime/pull/92714) and [dotnet/runtime#98037](https://github.com/dotnet/runtime/pull/98037) also improved vector construction, such as by enabling the mono JIT to utilize the Arm64 `ins` (Insert) instruction when creating one `float` or `double` vector from the values in another.
*   **More intrinsics.** [dotnet/runtime#98077](https://github.com/dotnet/runtime/pull/98077), [dotnet/runtime#98514](https://github.com/dotnet/runtime/pull/98514), and [dotnet/runtime#98710](https://github.com/dotnet/runtime/pull/98710) implemented various `AdvSimd.Load*` and `AdvSimd.Store*` APIs. [dotnet/runtime#99115](https://github.com/dotnet/runtime/pull/99115) and [dotnet/runtime#101622](https://github.com/dotnet/runtime/pull/101622) intrinsified several clearing and filling methods that back `Span<T>.Clear/Fill`. And [dotnet/runtime#105150](https://github.com/dotnet/runtime/pull/105150) and [dotnet/runtime#104698](https://github.com/dotnet/runtime/pull/104698) optimized various `Unsafe` methods, such as `BitCast`. [dotnet/runtime#91813](https://github.com/dotnet/runtime/pull/91813) also significantly improved unaligned access on a variety of CPUs by not forcing the implementation down a slow path if the CPU is able to handle such reads and writes.
*   **Startup**. [dotnet/runtime#100146](https://github.com/dotnet/runtime/pull/100146) is a fun one, as it had accidentally positive benefits for mono startup. The change updated dotnet/runtime’s configuration to enable more static analysis, and in particular enforcing [CA1865, CA1866, and CA1867](https://learn.microsoft.com/dotnet/fundamentals/code-analysis/quality-rules/ca1865-ca1867), which we hadn’t yet gotten around to enabling for the repo. The change included fixing all of the violations of the rules, which mostly meant fixing call sites like `IndexOf("!")` (`IndexOf` taking a single-character `string`) and replacing it with `IndexOf('!')`. The intent of the rule was that doing so is a little bit faster and the call site ends up being a little bit cleaner. But `IndexOf(string)` is cultural-aware, which means using it can force the globalization library ICU to be loaded and initialized. As it turns out, some of these uses were on mono’s startup path and were forcing ICU to be loaded when it wasn’t actually necessary. Fixing those meant the loading could be delayed, and startup performance improved as a result. [dotnet/runtime#101312](https://github.com/dotnet/runtime/pull/101312) also improved startup with the interpreter by adding a cache to the code that does vtable setups. This uses a custom hash table implementation added in [dotnet/runtime#100386](https://github.com/dotnet/runtime/pull/100386), which is then also used elsewhere, such as in [dotnet/runtime#101460](https://github.com/dotnet/runtime/pull/101460) and [dotnet/runtime#102476](https://github.com/dotnet/runtime/pull/102476). That hash table is itself interesting, as it’s lookups are vectorized for x64, Arm, and WASM and it’s generally optimized for cache locality.
*   **Variance check removal.** When storing objects into an array, that operation needs to be validated to ensure compatibility between the type being stored and the concrete type of the array. Given a base type `B` and two derived types `D1 : B` and `D2 : B`, you could have an array `B[] array = new D1[42];`, and then the code `array[0] = new D2()` would successfully compile, because `D2` is a `B`, but at run-time this must fail, as `D2` is not a `D1`, and so the runtime needs a check to ensure correctness. If the array’s type is sealed, though, this check can be avoided, since then you can’t end up with this discrepancy. coreclr already does that optimization; now as part of [dotnet/runtime#99829](https://github.com/dotnet/runtime/pull/99829), the mono interpreter does so as well.

Native AOT
----------

Native AOT is a solution for generating native executables directly from .NET applications. The resulting binary doesn’t require .NET to be installed and does not require JIT’ing; instead it contains in it all of the assembly code for the whole app, inclusive of the code for any core library functionality accessed, the assembly for the garbage collector, and so on. Native AOT first shipped in .NET 7 and was then significantly improved for .NET 8, in particular around reducing the size of the resulting applications. Now in .NET 9, investment continues in Native AOT, with some very nice fruits of the labor on it. (Note that the Native AOT tool chain uses the JIT to generate assembly code, so most of the code generation improvements discussed in the [JIT](#jit2) section and elsewhere in this post accrue to Native AOT as well.)

One of the biggest concerns for Native AOT is size and trimming. Native AOT-based applications and libraries compile everything, all user code, all the library code, the runtime, everything, into the single native binary. It’s thus imperative that the tool chain goes to extra lengths to get rid of as much as possible in order to keep that size down. This can include being more clever about how the runtime stores the state necessary for execution. It can include being more thoughtful about generics in order to reduce the possible code size explosion that can result from lots of generic instantiations (effectively multiple copies of the exact same code all specialized for different type arguments). And it can include being very diligent about avoiding dependencies that can bring in lots of code unexpectedly and that the trimming tools are unable to reason about enough to remove. Here are some examples of all of these in .NET 9:

*   **Refactoring choke points.** Think through your code: how many times have you written a method that takes some input and then dispatches to one of many different kinds of things based on the input provided? That’s reasonably common. Unfortunately, it can also be problematic for Native AOT code size. A good example is fixed by [dotnet/runtime#91185](https://github.com/dotnet/runtime/pull/91185) in `System.Security.Cryptography`. There are a bunch of hashing related types, like `SHA256` or `SHA3_384`, that all offer a `HashData` method. Then there are places where the exact hashing algorithm to be used is specified via a `HashAlgorithmName`. You can likely envision the large switch statement that results (or don’t imagine and instead just look at [the code](https://github.com/vcsjones/runtime/blob/0dbb857f21f5177abe7dcd431b07f36272aa8e28/src/libraries/Common/src/System/Security/Cryptography/HashOneShotHelpers.cs#L15-L26)), where based on the exact `HashAlgorithmName` specified, the implementation selects the right type’s `HashData` method to call. That is what’s often referred to as a “choke point,” where all callers end up coming through this one method, which then fans out to the relevant implementations, but that also then causes this size problem for Native AOT: if that choke point is referenced, it typically ends up needing to generate the code for all of the referenced methods, even if only a subset are actually used. Some of these cases are really challenging to solve. In this particular case, though, thankfully all of those `HashData` methods turned around and called to a parameterized, shared implementation. So the fix was to just skip the middle tier and have the `HashAlgorithmName` layer go directly to the workhorse implementation, without naming the intermediate layer methods.
*   **Less LINQ.** LINQ is an amazing productivity tool. We love LINQ and invest in it every release of .NET (see the later section in this post on [tons of performance improvements in LINQ in .NET 9](#linq32)). With Native AOT, however, significant use of LINQ can also measurably increase code size, in particular when value types are involved. As will be discussed later when talking about LINQ optimizations, one of the optimizations LINQ employs is to special-case based on the inputs what kind of `IEnumerable<T>` its methods give back. So, for example, if you call `Select` with an array input, the `IEnumerable<T>` you get back might actually be an instance of the internal `ArraySelectIterator<T>`, and if you call `Select` with a `List<T>`, the `IEnumerable<T>` you get back might actually be an instance of the internal `ListSelectIterator<T>`. The Native AOT trimmer can’t readily determine which of those paths might be used, so the Native AOT compiler needs to generate code for all such types when you call `Select<T>`. If the `T` is a reference type, there will just be a single copy of the generated code shared for all reference types. But if the `T` is a value type, there will be a custom stamp of the code generated for and optimized for each unique `T`. That means if such LINQ APIs (and other similar APIs) are used a lot, they can disproportionately increase the size of a Native AOT binary. [dotnet/runtime#98109](https://github.com/dotnet/runtime/pull/98109) is an example of a PR that replaced a bit of LINQ code in order to measurably reduce the size of ASP.NET applications compiled with Native AOT. But you can also see that PR being thoughtful about which LINQ usage was removed, citing these few specific instances making a measurable difference and leaving the rest of the LINQ usage in the library intact.
*   **Avoiding unnecessary array types.** The `SharedArrayPool<T>` that backs `ArrayPool<T>.Shared` was storing lots of state, including several fields with types along the lines of `T[][]`. This makes sense; it’s pooling arrays, so it needs an array of arrays. From a Native AOT perspective, though, if `T` is a value type (as is very common with `ArrayPool<T>`), `T[][]` as its own unique array type needs its own code generated for it, distinct from the code for, for example, `T[]`. As it turns out, `ArrayPool<T>` doesn’t actually need to work with the array instances in these cases, so it doesn’t actually need the strongly-typed nature of the arrays; this could just as well be `object[]` or `Array[]`. And that’s one of the main things that [dotnet/runtime#97058](https://github.com/dotnet/runtime/pull/97058) does: with that, the compiled binary can carry the code generated for just `Array[]` rather than needing code for `byte[][]` and `char[][]` and `object[][]` and for whatever other type `T`s are used with `ArrayPool<T>` in the application.
*   **Avoiding unnecessarily generic code.** The Native AOT compiler doesn’t do any kind of “outlining” today (the opposite of inlining, where, rather than moving code from a called method into the caller, the compiler would extract code from a method out into a separate method). If you have a large method, the compiler will need to generate code for the whole method, and if that method is generic and multiple generic specializations are compiled, the whole method will be compiled and optimized for each. But, if you have any meaningful amounts of code in that method that don’t actually depend on the generic types in question, you can avoid that duplication by refactoring the code into separate non-generic methods that are invoked by the generic. That’s what [dotnet/runtime#101474](https://github.com/dotnet/runtime/pull/101474) does in some of the types in `Microsoft.Extensions.Logging.Console`, like `SimpleConsoleFormatter` and `JsonConsoleFormatter`. There’s a generic `Write<TState>` method, but the `TState` is only used in the very first line of the method, which formats the arguments into a string. After that, there’s a lot of logic about doing the actual writing, but all of it only needs the output of that formatting operation, not the input. So, this PR simply refactors that `Write<TState>` to do the formatting and then delegates to the bulk of the work in a separate non-generic method.
*   **Cutting out unnecessary dependencies.** There are many small but meaningful dependencies one doesn’t think about until they start focusing on generated code size and zooming in on exactly where all that code size is coming from. [dotnet/runtime#95710](https://github.com/dotnet/runtime/pull/95710) is a good example. The `AppContext.OnProcessExit` method is rooted (never trimmed) by the runtime because it’s invoked when the process is exiting. That `OnProcessExit` was accessing `AppDomain.CurrentDomain`, which returns an `AppDomain`. `AppDomain`‘s `ToString` override depends on a bunch of stuff. And `ToString` on a type that’s not trimmed away is itself basically never trimmed because if anything anywhere calls to the base `object.ToString`, the system needs to know that any possible derived type that might find its way to that call site will be invokable. That all means that all of that stuff used by `AppDomain.ToString` was never being trimmed. This small refactoring made it so that all that stuff would only need to be kept if `AppDomain.CurrentDomain` is ever actually accessed by user code. Another example of this comes in [dotnet/runtime#101858](https://github.com/dotnet/runtime/pull/101858), which removes a dependency on some of the `Convert` methods.
*   **Using a better tool for the job.** Sometimes there’s just a better, simpler answer. [dotnet/runtime#100916](https://github.com/dotnet/runtime/pull/100916) highlights one such case. Some code in `Microsoft.Extensions.DependencyInjection` needed a `MethodInfo` for a particular method, and it was using `System.Linq.Expressions` to extract one, when it could instead just use a delegate. That’s not only cheaper in terms of allocation and overhead, it removes a dependency on the `Expressions` library.
*   **Compile time instead of run time.** Source generators are a great boon for Native AOT, as they enable computing things at build time and baking the results into the assembly rather than computing those same things at run time (which, in the relevant situations, typically is done once and then cached). That’s useful for startup performance, as you’re not having to do that work just to get going. It’s useful for steady-state throughput, as you can often take more time to do a better job when the work is being done at build time. But it’s also useful for size, because it removes a dependency on anything that might have been used as part of the computation. And often that dependency is reflection, which brings with it a lot of size. As it turns out, `System.Private.CoreLib` has its own source generator that’s used when building `CoreLib`, and [dotnet/runtime#102164](https://github.com/dotnet/runtime/pull/102164) augmented that source generator to generate a dedicated implementation of `Environment.Version` and `RuntimeInformation.FrameworkDescription`. Previously, both of these methods that are implemented in `CoreLib` would use reflection to look up attributes also in `CoreLib`, but that’s something the source generator can instead do at a build time, and just bake the answer into the implementation of these methods.
*   **Avoiding duplication.** It’s not uncommon to have two methods somewhere in your app that have the same implementations, especially for small helper methods, like property accessors. [dotnet/runtime#101969](https://github.com/dotnet/runtime/pull/101969) teaches the Native AOT tool chain to deduplicate those, such that the code is only stored once.
*   **Interfaces be gone.** Previously, unused interface methods could be trimmed away (effectively removing them from the interface type and removing all implementations of that method), but the compiler wasn’t able to fully remove the actual interface types themselves. Now with [dotnet/runtime#100000](https://github.com/dotnet/runtime/pull/100000), it can.
*   **Unnecessary static constructors.** The trimmer was keeping the static constructor of a type if any field was accessed. This is unnecessarily broad: those static constructors only need to be kept if a _static_ field was accessed. [dotnet/runtime#96656](https://github.com/dotnet/runtime/pull/96656) improves that.

Previous releases saw a considerable amount of time spent on driving down binary sizes, but these kinds of changes chip away at them even further. Let’s create a new ASP.NET minimal APIs application using Native AOT. This command uses the `webapiaot` template and creates the new project in a new `myapp` directory:

    dotnet new webapiaot -o myapp

Replace the contents of the generated `myapp.csproj` with this:

    <Project Sdk="Microsoft.NET.Sdk.Web">
    
      <PropertyGroup>
        <TargetFrameworks>net9.0;net8.0</TargetFrameworks>
        <Nullable>enable</Nullable>
        <ImplicitUsings>enable</ImplicitUsings>
        <InvariantGlobalization>true</InvariantGlobalization>
        <PublishAot>true</PublishAot>
    
        <OptimizationPreference>Size</OptimizationPreference>
        <StackTraceSupport>false</StackTraceSupport>
      </PropertyGroup>
    
    </Project>

All I’ve done on top of the template’s defaults is have both `net9.0` and `net8.0` as target frameworks and then add a couple of settings (at the bottom) focused on driving down the size of Native AOT apps. The app is a simple site that exposes a `/todos` list as JSON. ![Todos application](https://devblogs.microsoft.com/dotnet/wp-content/uploads/sites/10/2024/09/TodosApp.png)

We can publish this app with Native AOT:

    dotnet publish -f net8.0 -r linux-x64 -c Release
    ls -hs bin/Release/net8.0/linux-x64/publish/myapp

which yields:

    9.4M bin/Release/net8.0/linux-x64/publish/myapp

We can see here that the whole site, web server, garbage collector, everything, are contained in `myapp` app, which on .NET 8 is weighing in at 9.4 megabytes. Now, let’s do the same thing for .NET 9:

    dotnet publish -f net9.0 -r linux-x64 -c Release
    ls -hs bin/Release/net9.0/linux-x64/publish/myapp

which results in:

    8.5M bin/Release/net9.0/linux-x64/publish/myapp

Now, just by moving to the new version, that same `myapp` has shrunk to 8.5 megabytes, an ~10% reduction in binary size.

Beyond a focus on size, ahead-of-time compilation also differs from just-in-time compilation in that each has their own opportunities for unique optimizations. The JIT can see the exact details of the current machine and employ the best possible instructions based on what’s available (e.g. using AVX512 instructions on hardware that supports it), and the JIT can use dynamic PGO to evolve the code based on execution characteristic. But, Native AOT is capable of doing whole program optimization, where it can look at everything in the program and optimize based on the totality of everything involved (in contrast, a JIT’d .NET application may load additional .NET libraries at any point). For example, [dotnet/runtime#92923](https://github.com/dotnet/runtime/pull/92923) enables automatically making fields `readonly` based on looking at the whole program to see if anything could possibly write to the field from outside of the constructor; this can in turn help things like improving pre-initialization.

[dotnet/runtime#99761](https://github.com/dotnet/runtime/pull/99761) provides a nice example where, based on whole program analysis, the compiler can see that a particular type is never instantiated. If it’s never instantiated, then type checks for that type will never succeed. And thus if a program has a check like `if (variable is SomethingNeverInstantiated)`, that can be turned into a constant `false`, and all of the code associated with that `if` block then eliminated. [dotnet/runtime#102248](https://github.com/dotnet/runtime/pull/102248) is similar, but for types; if code is doing `if (someType == typeof(X))` and the compiler never had to construct a method table for `X`, it can similarly turn this into a constant result.

Whole program analysis is also applicable to devirtualization in really cool ways. With [dotnet/runtime#92440](https://github.com/dotnet/runtime/pull/92440), the compiler can now devirtualize all calls to a virtual method `C.M` if the compiler doesn’t see any instantiations of types that derive from `C`. And with [dotnet/runtime#97812](https://github.com/dotnet/runtime/pull/97812) and [dotnet/runtime#97867](https://github.com/dotnet/runtime/pull/97867), the compiler can now treat `virtual` methods as instead being non-`virtual` and `sealed` when there are no overrides of those methods anywhere in the program.

NativeAOT also has a super power in its ability to do pre-initialization. The compiler contains an interpreter that’s able to evaluate code at build time and replace that code with just the result; for some objects, it’s then also able to blit the object’s data into the binary in a way that it can be cheaply dehydrated at execution time. The interpreter is limited in what it’s able and allowed to do, but over time its capabilities are improving. [dotnet/runtime#92470](https://github.com/dotnet/runtime/pull/92470) extends it to support more type checks, static interface method calls, constrained method calls, and various operations on spans, while [dotnet/runtime#92666](https://github.com/dotnet/runtime/pull/92666) expands it to have some support for hardware intrinsics and the various `IsSupported` methods. [dotnet/runtime#92739](https://github.com/dotnet/runtime/pull/92739) further rounds it out with support for `stackalloc`‘ing spans, `IntPtr`/`nint` math, and `Unsafe.Add`.

Threading
---------

Since the beginning of .NET, general wisdom has been that the vast majority of code that needs to synchronize access to shared state should just use `Monitor`, either directly or more likely via the the C# language syntax for it with `lock(...)`. There are a plethora of other synchronization primitives available, at various levels of complexity and with varying purposes, but `lock(...)` is the workhorse and the thing that everyone should reach for by default.

Over 20 years after the introduction of .NET, that’s evolving, just a bit. `lock(...)` is still the go-to syntax, but in .NET 9 as of [dotnet/runtime#87672](https://github.com/dotnet/runtime/pull/87672) and [dotnet/runtime#102222](https://github.com/dotnet/runtime/pull/102222), there is now a dedicated `System.Threading.Lock` type. Anywhere you were previously allocating an `object` just to use that `object` with `lock(...)`, you should consider using the new `Lock` type. You can absolutely still just use `object`, and you’ll still need to do so in certain situations, like if you’re using the “condition variable” aspects of `Monitor` (such as `Signal` and `Wait`), and you’ll still want to in others (such as if you’re trying to reduce managed allocation and you have another existing object that can serve double-duty as the monitor). But locking a `Lock` can be a more efficient answer. It can also help to be self-documenting, making the code cleaner and more maintainable.

As is evident from this benchmark, the syntax for using both can be identical.

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private readonly object _monitor = new();
        private readonly Lock _lock = new();
        private int _value;
    
        [Benchmark]
        public void WithMonitor()
        {
            lock (_monitor)
            {
                _value++;
            }
        }
    
        [Benchmark]
        public void WithLock()
        {
            lock (_lock)
            {
                _value++;
            }
        }
    }

`Lock`, however, will generally be a tad cheaper (and in the future, as most locking shifts to use the new type, we may be able to make most `object`s lighter weight by not optimizing for direct locking on arbitrary objects):

Method

Mean

WithMonitor

14.30 ns

WithLock

13.86 ns

Note that C# 13 has special-recognition of `System.Threading.Lock`. If you look at the code that’s generated for `WithMonitor` above, it’s equivalent to this:

    public void WithMonitor()
    {
        object monitor = _monitor;
        bool lockTaken = false;
        try
        {
            Monitor.Enter(monitor, ref lockTaken);
            _value++;
        }
        finally
        {
            if (lockTaken)
            {
                Monitor.Exit(monitor);
            }
        }
    }

but even though the syntax is identical, here’s an equivalent of what’s generated for `WithLock`:

    Lock.Scope scope = _lock.EnterScope();
    try
    {
        _value++;
    }
    finally
    {
        scope.Dispose();
    }

We’ve also started using `Lock` internally. [dotnet/runtime#103085](https://github.com/dotnet/runtime/pull/103085) and [dotnet/runtime#103104](https://github.com/dotnet/runtime/pull/103104) used it instead of `object` locks in `Timer`, `ThreadLocal`, and `RegisteredWaitHandle`. In time, I expect to see more and more use switched over.

Of course, while locks are the default recommendation for synchronization, there’s still a lot of code that demands the higher throughput and scalability that comes from more lock-free programming, and the workhorse for such implementations is `Interlocked`. In .NET 9, `Interlocked.Exchange` and `Interlocked.CompareExchange` gain some very welcome capabilities. First, [dotnet/runtime#92974](https://github.com/dotnet/runtime/pull/92974) from [@MichalPetryka](https://github.com/MichalPetryka), [dotnet/runtime#97588](https://github.com/dotnet/runtime/pull/97588) from [@filipnavara](https://github.com/filipnavara), and [dotnet/runtime#106660](https://github.com/dotnet/runtime/pull/106660) grant `Interlocked` some new powers, the ability to operate over types smaller than `int`. It introduces new overloads of `Exchange` and `CompareExchange` that can work on `byte`, `sbyte`, `ushort`, and `short`. These overloads are public and available for anyone to call, but they’re also then consumed by [dotnet/runtime#97528](https://github.com/dotnet/runtime/pull/97528) from [@MichalPetryka](https://github.com/MichalPetryka) to improve `Parallel.ForAsync<T>`. `ForAsync` is given a range of `T` to be processed, and schedules multiple workers that all need to repeatedly get the next item from the range, until the range is exhausted. For arbitrary types, that means `ForAsync` needs to lock to protect the increment while iterating through the range. But for types where an `Interlocked` operation is available, we can use that with low-lock techniques to avoid the lock entirely (both the need to access it and the need to allocate it).

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        public async Task ParallelForAsync()
        {
            await Parallel.ForAsync('\0', '\uFFFF', async (c, _) =>
            {
            });
        }
    }

Method

Runtime

Mean

Ratio

ParallelForAsync

.NET 8.0

42.807 ms

1.00

ParallelForAsync

.NET 9.0

7.184 ms

0.17

Even with those new overloads, though, there are still places it’s desirable to use `Interlocked.Exchange` or `Interlocked.CompareExchange` where they can’t be used easily. Consider the aforementioned `Parallel.ForAsync`. It’d be really nice if we could just call `Interlocked.CompareExchange<T>`, but `CompareExchange<T>` only works with reference types. So we’re instead left with unsafe code:

    static unsafe bool CompareExchange(ref T location, T value, T comparand) =>
        sizeof(T) == sizeof(byte) ? Interlocked.CompareExchange(ref Unsafe.As<T, byte>(ref location), Unsafe.As<T, byte>(ref value), Unsafe.As<T, byte>(ref comparand)) == Unsafe.As<T, byte>(ref comparand) :
        sizeof(T) == sizeof(ushort) ? Interlocked.CompareExchange(ref Unsafe.As<T, ushort>(ref location), Unsafe.As<T, ushort>(ref value), Unsafe.As<T, ushort>(ref comparand)) == Unsafe.As<T, ushort>(ref comparand) :
        sizeof(T) == sizeof(uint) ? Interlocked.CompareExchange(ref Unsafe.As<T, uint>(ref location), Unsafe.As<T, uint>(ref value), Unsafe.As<T, uint>(ref comparand)) == Unsafe.As<T, uint>(ref comparand) :
        sizeof(T) == sizeof(ulong) ? Interlocked.CompareExchange(ref Unsafe.As<T, ulong>(ref location), Unsafe.As<T, ulong>(ref value), Unsafe.As<T, ulong>(ref comparand)) == Unsafe.As<T, ulong>(ref comparand) :
        throw new UnreachableException();

Another place it’d be really nice to use `Interlocked.Exchange` and `Interlocked.CompareExchange` is with enums. It’s reasonable common to use these APIs to transition between states in some algorithm, and often the ideal is for those states to be represented as an enum. However, there are no overloads of `{Compare}Exchange` that have worked with enums, so developers have been forced to use integers instead, often with comments stating something along the lines of “This should be an enum, but enums can’t work with CompareExchange.” Or, at least, they couldn’t, until .NET 9.

Now in .NET 9, as of [dotnet/runtime#104558](https://github.com/dotnet/runtime/pull/104558) the generic `Exchange` and `CompareExchange` have had their `class` constraint removed. This means use of `Exchange<T>` and `CompareExchange<T>` will compile for any `T`. Then at runtime, the `T` is checked to ensure it’s a reference type, a primitive type, or an enum type; anything else, and it’ll throw. When it is one of those, it delegates to the correspondingly-sized overload. For example, this now compiles and runs successfully:

    static DayOfWeek UpdateIfEqual(ref DayOfWeek location, DayOfWeek newValue, DayOfWeek expectedValue) =>
        Interlocked.CompareExchange(ref location, newValue, expectedValue);

This is not only good for usability, it’s good for performance in a few ways. First, it enables performance improvements like the `Parallel.ForAsync` one described without needing to resort to `Unsafe` tricks. But second, it enables smaller objects. The previously listed change not only updated `CompareExchange` to remove the constraint but also then employed the overload in dozens of places. In `Http3Connection`, for example, the object previously had these three fields which were updated with `Interlocked.Exchange`:

    private int _haveServerControlStream;
    private int _haveServerQpackDecodeStream;
    private int _haveServerQpackEncodeStream;

but these are really just `bool`s masquerading as `int`s, exactly because they needed to be updated atomically. Now with `Interlocked.Exchange<T>` and `Interlocked.CompareExchange<T>` supporting `bool`, these have been updated to just be:

    private bool _haveServerControlStream;
    private bool _haveServerQpackDecodeStream;
    private bool _haveServerQpackEncodeStream;

Any additional padding aside, that reduces 12 bytes down to 3 bytes on the object.

Also related to `Interlocked`, [dotnet/runtime#96258](https://github.com/dotnet/runtime/pull/96258) intrinsifies the `Interlocked.And` and `Interlocked.Or` methods for additional platforms; previously they were specially handled on Arm, but now they’re also specially handled on x86/64. As an example, the implementation in the `And` method is a fairly typical `CompareExchange` loop:

    public static int And(ref int location1, int value)
    {
        int current = location1;
        while (true)
        {
            int newValue = current & value;
            int oldValue = CompareExchange(ref location1, newValue, current);
            if (oldValue == current)
            {
                return oldValue;
            }
            current = oldValue;
        }
    }

You’ll see a very similar loop any time you want to use optimistic concurrency to create a new value and substitute it for the original in an atomic manner. The actual `&` operation is just one line here, and to highlight that this is broadly applicable, you could create a generalized version of this method for any operation using a delegate, like this:

    public static int CompareExchange(ref int location1, int value, Func<int, int, int> update)
    {
        int current = location1;
        while (true)
        {
            int newValue = update(current, value);
            int oldValue = CompareExchange(ref location1, newValue, current);
            if (oldValue == current)
            {
                return oldValue;
            }
            current = oldValue;
        }
    }

such that `And` could be implemented then like:

    public static int And(ref int location1, int value) =>
        CompareExchange(ref location1, value, static (current, value) => current & value)

The approach employed by `And` is reasonable when there’s nothing better you can do, but as it turns out, modern hardware platforms have single instructions capable of performing such an interlocked `and` and `or` in a much more efficient manner. The JIT already handled this for Arm because the instructions on Arm have semantics that very closely align with the semantics of `Interlocked.And` and `Interlocked.Or`. On x86/64, however, the relevant instruction sequence (`lock and` or `lock or`) doesn’t enable accessing the original value atomically replaced, whereas `And`/`Or` require that as part of their definition. Luckily, most uses of `Interlocked.And`/`Interlocked.Or` don’t actually need the return value. For example, `SafeHandle.SetHandleAsInvalid` simply wants to atomically OR an additional flag into some bit flags, ignoring the result of `Or`:

    public void SetHandleAsInvalid()
    {
        Interlocked.Or(ref _state, StateBits.Closed);
        GC.SuppressFinalize(this);
    }

And luckily, the JIT can see that it’s ignoring the result. As such, on x86/64, the JIT can use the optimal sequence when it can see that the result isn’t being used, and even if it is being used, it can still emit a slightly more concise instruction sequence than would have naturally resulted from our open-coded implementation:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private int _location;
    
        [Benchmark] public void Test_ResultNotUsed() => Interlocked.And(ref _location, 42);
        [Benchmark] public int  Test_ResultUsed() =>    Interlocked.And(ref _location, 42);
    }

    // .NET 8
    ; Tests.Test_ResultNotUsed()
           push      rbp
           sub       rsp,10
           lea       rbp,[rsp+10]
           add       rdi,8
           mov       eax,[rdi]
    M00_L00:
           mov       ecx,eax
           and       ecx,2A
           mov       [rbp-4],eax
           lock cmpxchg [rdi],ecx
           mov       ecx,[rbp-4]
           cmp       eax,ecx
           je        short M00_L01
           mov       ecx,eax
           mov       eax,ecx
           jmp       short M00_L00
    M00_L01:
           add       rsp,10
           pop       rbp
           ret
    ; Total bytes of code 47
    
    ; Tests.Test_ResultUsed()
           push      rbp
           sub       rsp,10
           lea       rbp,[rsp+10]
           add       rdi,8
           mov       eax,[rdi]
    M00_L00:
           mov       ecx,eax
           and       ecx,2A
           mov       [rbp-4],eax
           lock cmpxchg [rdi],ecx
           mov       ecx,[rbp-4]
           cmp       eax,ecx
           je        short M00_L01
           mov       ecx,eax
           mov       eax,ecx
           jmp       short M00_L00
    M00_L01:
           add       rsp,10
           pop       rbp
           ret
    ; Total bytes of code 47
    
    // .NET 9
    ; Tests.Test_ResultNotUsed()
           add       rdi,8
           mov       eax,2A
           lock and  [rdi],eax
           ret
    ; Total bytes of code 13
    
    ; Tests.Test_ResultUsed()
           add       rdi,8
           mov       ecx,2A
           mov       eax,[rdi]
    M00_L00:
           mov       edx,eax
           and       edx,ecx
           lock cmpxchg [rdi],edx
           jne       short M00_L00
           ret
    ; Total bytes of code 22

Method

Runtime

Mean

Ratio

Code Size

Test\_ResultNotUsed

.NET 8.0

6.630 ns

1.00

47 B

Test\_ResultNotUsed

.NET 9.0

3.132 ns

0.47

13 B

Test\_ResultUsed

.NET 8.0

6.853 ns

1.00

47 B

Test\_ResultUsed

.NET 9.0

6.435 ns

0.94

22 B

Locks and interlocked operations are about coordinating between operations, at a relatively low level. There are higher level coordination constructs as well; that’s effectively what `Task` is, providing a representation for a piece of work with which you can later join. Such joining can be accomplished with `await` along with a myriad of APIs that faciliate joining with tasks in various ways. In that regard, one of my favorite new APIs in .NET 9 is on `Task`: `Task.WhenEach`. I like it because it utilizes newer language features to cleanly solve a problem that we wanted to solve over a decade ago when `Task` was originally introduced, and the lack of it has led to folks writing code with known pits of failure.

`Task.WhenAll` is fairly easy to understand: you give it a collection of tasks, and the task it returns will complete only when all of the constituent tasks have completed:

    await Task.WhenAll([t1, t2, t3]);
    ... // only get here when t1, t2, and t3 have all completed successfully

`Task.WhenAny` is a bit more complex, in that it returns when any of the constituent tasks has completed, and it gives you back a reference to that task:

    Task tCompleted = await Task.WhenAny([t1, t2, t3]);
    ... // tCompleted is either t1, t2, or t3, and will be completed here

and you can then explicitly join with that returned task to observe any exceptions it may have incurred or consume its result value if it has one. But what do you then do to join with the remaining two tasks? You might end up writing code something like this:

    List<Task> tasks = new() { t1, t2, t3 };
    while (tasks.Count > 0)
    {
        Task completed = await Task.WhenAny(tasks);
        Handle(completed);
        tasks.Remove(completed);
    }

That’s not terribly hard, but it’s also not terribly efficient. Or, rather, for larger number of tasks, it’s terribly inefficient, as it’s an `O(N^2)` algorithm. Some of the complexity is likely obvious: you’ve got a loop and inside that loop you’ve got a `List<T>.Remove` call, which will do an `O(N)` walk of the list looking for the target element to remove: there’s the `O(N^2)`. But, there’s actually another less obvious `O(N)` operation in the loop: the `WhenAny` itself. Every call to `WhenAny` needs to hook a continuation up to each of the constituent `Task` objects. (There are of course cheaper ways to implement this functionality than using such a `WhenAny`, but they’re all more complicated and thus not the answers towards which folks have gravitated.)

Enter `Task.WhenEach`. `WhenEach`‘s purpose is to make consuming tasks as they complete both simple and efficient. To do so, rather than returning a `Task<Task>` as does `WhenAny`, it returns an `IAsyncEnumerable<Task>`, so one can simply iterate through the completing tasks as they complete.

    await foreach (Task completed in Task.WhenEach([t1, t2, t3]))
    {
        Debug.Assert(completed.IsCompleted);
        Handle(completed);
    }

It’s a little hard to get a good applies-to-apples comparison of the overhead here, but this benchmark is a reasonable approximation:

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Params(10, 1_000)]
        public int Count { get; set; }
    
        [Benchmark]
        public async Task WithWhenAny()
        {
            var tcs = Enumerable.Range(0, Count).Select(_ => new TaskCompletionSource()).ToList();
    
            List<Task> tasks = tcs.Select(t => t.Task).ToList();
            tcs[^1].SetResult();
            while (tasks.Count > 0)
            {
                Task completed = await Task.WhenAny(tasks);
                tasks.Remove(completed);
                tcs.RemoveAt(tcs.Count - 1);
    
                if (tasks.Count == 0) break;
                tcs[^1].SetResult();
            }
        }
    
        [Benchmark]
        public async Task WithWhenEach()
        {
            var tcs = Enumerable.Range(0, Count).Select(_ => new TaskCompletionSource()).ToList();
    
            int remaining = tcs.Count - 1;
            tcs[remaining].SetResult();
            await foreach (Task completed in Task.WhenEach(tcs.Select(t => t.Task)))
            {
                if (remaining == 0) break;
                tcs[--remaining].SetResult();
            }
        }
    }

Method

Count

Mean

Allocated

WithWhenAny

10

3.232 us

3.47 KB

WithWhenEach

10

1.223 us

1.43 KB

WithWhenAny

1000

20,082.683 us

4207.12 KB

WithWhenEach

1000

102.759 us

94.24 KB

`WhenAll` also gets a bit cheaper, in a couple of ways. [dotnet/runtime#93953](https://github.com/dotnet/runtime/pull/93953) utilizes a trick employed elsewhere in `Task` in .NET 8, which is to use its used `m_stateObject` field (unused because there’s no way to set it with `WhenAll`) to store some of the state that previously had a dedicated field (a field for storing information about constituent tasks that failed or were canceled). That means the `Task` object `WhenAll` returns gets 8 bytes smaller (on 64-bit). On top of that, [dotnet/runtime#101308](https://github.com/dotnet/runtime/pull/101308) adds new `ReadOnlySpan<T>`\-based overloads to a bunch of methods, including `Task.WhenAll`. This enables passing in any number of tasks without needing to allocate.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Runtime.CompilerServices;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        public async Task WhenAll()
        {
            var atmb1 = new AsyncTaskMethodBuilder();
            var atmb2 = new AsyncTaskMethodBuilder();
            Task whenAll = Task.WhenAll([atmb1.Task, atmb2.Task]);
            atmb1.SetResult();
            atmb2.SetResult();
            await whenAll;
        }
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

WhenAll

.NET 8.0

123.8 ns

1.00

264 B

1.00

WhenAll

.NET 9.0

103.8 ns

0.86

216 B

0.82

There are some other interesting performance improvements in threading in .NET 9 as well.

*   **Debugger.NotifyOfCrossThreadDependency.** This is a big deal. When you’re debugging a .NET process and you break in the debugger, it pauses all threads in the debuggee process so that nothing is making forward progress while you examine state. However, .NET debuggers, like the one in Visual Studio, support invoking properties and methods in the debuggee while debugging. That can be a big problem if the functionality being invoked relies on one of those paused threads to do something, e.g. if the property you access tries to take a lock that’s held by another thread or tries to `Wait` on a `Task`. To mitigate problems here, the `Debugger.NotifyOfCrossThreadDependency` method exists. Functionality that relies on another thread to do something can call `NotifyOfCrossThreadDependency`; if there’s no debugger attached, it’s a nop, but if there is a debugger attached, this signals the problem to the debugger, which can then react accordingly. The Visual Studio debugger reacts by stopping the evaluation but then by offering an opt-in option of “slipping” all threads, unpausing all threads until the evaluated operation completes, at which point all threads will be paused again, thereby again trying to mitigate any problems that might occur from the cross-thread dependency. `NotifyOfCrossThreadDependency` is generally not used by application code, but it’s used in a few critical choke points in the core libraries, in particular throughout `System.Threading` and the infrastructure for `async`/`await`. That means, for example, that this method is being called any time you `await` a `Task` that’s not yet completed. And, unfortunately, while the method is a cheap nop when the debugger isn’t attached, historically it’s been fairly expensive when the debugger is attached, to the point where it can meaningfully impact a developer’s experience in the tool. Thankfully, .NET 9 addresses this with [dotnet/runtime#101864](https://github.com/dotnet/runtime/pull/101864), which significantly improves the performance of `NotifyOfCrossThreadDependency` when a debugger is attached. We can see this with a low-tech benchmark. Replace the contents of your `Program.cs` with this:
    
        using System.Diagnostics;
        
        const int Iters = 100_000;
        Stopwatch sw = new();
        while (true)
        {
            sw.Restart();
            for (int i = 0; i < Iters; i++)
            {
                Debugger.NotifyOfCrossThreadDependency();
            }
            sw.Stop();
            Console.WriteLine($"{sw.Elapsed.TotalMicroseconds / Iters:N3}us");
        }
    
    open the project in Visual Studio, ensure that .NET 8 is selected as the target framework and that you’re targeting Release: ![Selecting .NET 8 target framework](https://devblogs.microsoft.com/dotnet/wp-content/uploads/sites/10/2024/09/TargetingNet8Dropdown.png)
    
    and run with the debugger attached (F5, not ctrl-F5). When I do that, I see numbers like this (on Windows):
    
        48.360us
        45.281us
        46.714us
        46.945us
        46.525us
    
    Then change the target framework to be .NET 9, and run with the debugger attached again. I then see numbers like this:
    
        1.973us
        1.713us
        1.714us
        1.871us
        1.963us
    
    While such an improvement shouldn’t impact your production workloads, it can make an impactful difference to your productivity as a developer.
    
*   **Volatile.** A “memory model” is a description of how threads interact with memory and what guarantees are made about how different threads produce and consume changes in shared memory. Reads and writes to memory from a single thread are guaranteed to be observed by that thread in the order they occurred, but once multiple threads enter the picture, it’s up to the memory model to define what behaviors can be relied on and which can’t. For example, if there are two fields, `_a` and `_b`, both of which start as `0`, and if one thread does:
    
        _a = 1;
        _b = 2;
    
    and then another does:
    
        while (_b != 2);
        Assert(_a == 1);
    
    is that assert guaranteed to always pass? It depends on the memory model, and whether the writes from thread 1 might get reordered (by any of the involved compilers or even by the hardware) such that the write to `_b` became visible to thread 2 before the write to `_a`. For the longest time, the only official memory model for .NET was the one defined by the [ECMA 335](https://ecma-international.org/publications-and-standards/standards/ecma-335/) specification, but real implementations, including coreclr, generally had stronger guarantees than what ECMA detailed. Thankfully, the official [.NET memory model](https://github.com/dotnet/runtime/blob/main/docs/design/specs/Memory-model.md) has now been documented. However, some of the practices that were being employed in the core libraries (due to defensive coding or uncertainty of the memory model or out-of-date requirements) are no longer necessary. One of the main tools available for folks coding at a level where memory model is relevant is the `volatile` keyword / the `Volatile` class. Marking a field as `volatile` causes any reads or writes of that field to be considered “volatile,” just as does using `Volatile.Read`/`Volatile.Write` to perform that read or write. Making the read or write volatile means it prevents certain kinds of “movement,” e.g. if both `_a` and `_b` in the previous example were marked as `volatile`, the assert would always pass. Marking fields or operations as `volatile` can come with an expense, depending on the circumstance and the target platform. For example, it can restrict the C# compiler and the JIT compiler from performing certain optimizations. Let’s take a simple example. This code:
    
        // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [DisassemblyDiagnoser]
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            private volatile int _volatile;
            private int _nonVolatile;
        
            [Benchmark]
            public int UsingVolatile() => _volatile + _volatile;
        
            [Benchmark]
            public int UsingNonVolatile() => _nonVolatile + _nonVolatile;
        }
    
    results in this assembly on .NET 9:
    
        ; Tests.UsingVolatile()
               mov       eax,[rdi+8]
               add       eax,[rdi+8]
               ret
        ; Total bytes of code 7
        
        ; Tests.UsingNonVolatile()
               mov       eax,[rdi+0C]
               add       eax,eax
               ret
        ; Total bytes of code 6
    
    The important difference between the two assembly blocks is in the `add` instruction. In the `UsingVolatile` method, the first instruction is loading the value from memory stored at address `rcx+8`, and then re-reading that same `rcx+8` memory location again to add whatever is there with what it just read. In `UsingNonVolatile`, it starts the same way, reading the value stored at `rcx+0xc`, but then the `add` isn’t doing another memory read and is instead just doubling the value stored in the register. One of the effects of `volatile` requiring that reads can’t be moved is also that they can’t be _removed_, which means both reads in the code are required to stay. Here’s another example:
    
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [DisassemblyDiagnoser]
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            private volatile bool _volatile;
            private bool _nonVolatile;
        
            [Benchmark]
            public int CountVolatile()
            {
                int count = 0;
                while (_volatile) count++;
                return count;
            }
        
            [Benchmark]
            public int CountNonVolatile()
            {
                int count = 0;
                while (_nonVolatile) count++;
                return count;
            }
        }
    
    which on .NET 9 produces this assembly:
    
        ; Tests.CountVolatile()
               push      rbp
               mov       rbp,rsp
               xor       eax,eax
               cmp       byte ptr [rdi+8],0
               jne       short M00_L01
        M00_L00:
               pop       rbp
               ret
        M00_L01:
               inc       eax
               cmp       byte ptr [rdi+8],0
               jne       short M00_L01
               jmp       short M00_L00
        ; Total bytes of code 24
        
        ; Tests.CountNonVolatile()
               push      rbp
               mov       rbp,rsp
               xor       eax,eax
               cmp       byte ptr [rdi+9],0
               jne       short M00_L00
               pop       rbp
               ret
        M00_L00:
               jmp       short M00_L00
        ; Total bytes of code 16
    
    They look somewhat similar, in fact the first five instructions are almost identical, but there’s a critical difference. In both cases, the `bool` value is being loaded and checked to see if it’s `false` (the `cmp` against `0` followed by a conditional jump), in which case the implementations both fall through to the ending `ret` to exit out of the method. The compiler is rewriting the `while (cond) { ... }` loop to instead be more like an `if (cond) { do { ... } while(cond); }`, so this initial test is the one for that `if (cond)`. But then things diverge meaningfully. `CountVolatile` then proceeds to do the `do while` equivalent, incrementing the `count` (stored in `eax`), reading `_volatile` and comparing it to `0` (`false`), and if it’s still `true`, jumping back up to loop again. So basically what you’d expect. But now look at `CountNonVolatile`. The loop is just this:
    
        M00_L00:
               jmp       short M00_L00
    
    It’s now sitting in an infinite loop, with an unconditional jump back to the same `jmp` instruction, looping forever. That’s because the JIT was able to hoist the read of `_nonVolatile` out of the loop. It then also sees that no one will ever observe `count`‘s changed value, so it also elides the increment. At which point it’s more like if I’d written this C#:
    
        public int CountNonVolatile()
        {
            int count = 0;
            if (_nonVolatile)
            {
                while (true);
            }
        
            return count;
        }
    
    That hoisting can’t be done when the field is `volatile`, because it can’t reorder or remove reads associated with the field. But with `_nonVolatile`, nothing prevents that. On multiple occasions I’ve seen folks trying to engage in low-lock programming experience the ramifications of this latter example: they’ll be using some `bool` to signal to a consumer that it should break out of the loop, but the `bool` isn’t volatile, and the consumer then never notices when the producer eventually sets it.
    
    Those are examples of the ramifications of `volatile` in terms of what the C# or JIT compiler are constrained from doing. But there are also things the JIT _needs_ to do (rather than avoid) in order to ensure the hardware can respect the requirements put in place by the developer. On some hardware, like x64, the memory model of the hardware is relatively “strong,” meaning it doesn’t do most of the kinds of reorderings that `volatile` inhibits, and therefore you won’t see anything emitted into the assembly code by the JIT to help the hardware enforce the constraints. On other hardware, like Arm64, though, the hardware has a relatively “weaker” model, meaning it allows more of these kinds of reorderings, and as a result, the JIT needs to actively inhibit such reorderings by inserting appropriate “memory barriers” into the code. On Arm, this shows up with instructions like `dmb` (“data memory barrier”). Such barriers have some overhead associated with them.
    
    For all of these reasons, fewer `volatile`s is good for performance, but of course you need to ensure you have enough `volatile`s to actually achieve a correct application (with the best answer being avoid writing lock-lock code in the first place, and then you never need to know or think about `volatile`). It’s a balance. Luckily, and bringing us full circle to why we’re talking about this, there are a set of common cases where `volatile` used to be recommended but now that we have a well-defined memory model, those uses are obsolete. Removing them can help to avoid a layer of thin cost across the code. So [dotnet/runtime#100969](https://github.com/dotnet/runtime/pull/100969) and [dotnet/runtime#101346](https://github.com/dotnet/runtime/pull/101346) removed a bunch of `volatile` usage where it was no longer necessary. Almost all of these uses were as part of lazy initialization of reference types, e.g.
    
        private volatile MyReferenceType? _instance;
        
        public MyReferenceType Instance => _instance ??= new MyReferenceType();
    
    which if we expand that out to not use `??=` looks something like this:
    
        private MyReferenceType? _instance;
        
        public MyReferenceType Instance
        {
            get
            {
                MyReferenceType? instance = _instance;
                if (instance is null)
                {
                    _instance = instance = new MyReferenceType();
                }
        
                return instance;
            }
        }
    
    The reason for the `volatile` here would be two-fold, one for the part of the operation that reads and one for the part of the operation that writes. Without the `volatile`, the concern would be that one of the compilers or the hardware could actually “introduce a read,” effectively making the code equivalent to this:
    
        private MyReferenceType? _instance;
        
        public MyReferenceType Instance
        {
            get
            {
                MyReferenceType? instance = _instance;
                if (_instance is null) // NOTE THE _ HERE
                {
                    _instance = instance = new MyReferenceType();
                }
        
                return instance;
            }
        }
    
    If that were to happen, there’s a problem that between the two reads, the value of `_instance` could go from `null` to non-`null`, in which case `instance` could be assigned `null`, `_instance is null` might then be false, and `return instance` would return `null`. However, the .NET memory model explicitly states “Reads cannot be introduced.” Then there’s the concern about the write. The concern there that leads to `volatile` being used is the initialization that happens inside of `MyReferenceType`. Imagine if `MyReferenceType` were defined like this:
    
        class MyReferenceType()
        {
            internal int _value;
            public MyReferenceType() => _value = 42;
        }
    
    The question then becomes “is it possible for the write to `_value` inside of the constructor to be viewed by another thread _after_ the write of the instance to `_instance`“? In other words, could the code logically become the equivalent of this:
    
        private MyReferenceType? _instance;
        
        public MyReferenceType Instance
        {
            get
            {
                MyReferenceType? instance = _instance;
                if (_instance is null)
                {
                    _instance = instance = RuntimeHelpers.GetUninitializedObject(typeof(MyReferenceType));
                    instance._value = 42;
                }
        
                return instance;
            }
        }
    
    If that could happen, then two threads could be racing to access `Instance`, one of them could get as far as setting `_instance` (but `_value` hasn’t been set yet), then another thread could access `Instance`, see `_instance` as non-`null`, and start using it, even though `_value` hasn’t yet been initialized. Thankfully here as well, the .NET memory model doesn’t allow such transformations, explicitly covering this point:
    
    > “Object assignment to a location potentially accessible by other threads is a release with respect to accesses to the instance’s fields/elements and metadata. An optimizing compiler must preserve the order of object assignment and data-dependent memory accesses. The motivation is to ensure that storing an object reference to shared memory acts as a “committing point” to all modifications that are reachable through the instance reference.”
    
    Phew!
    
*   **ManagedThreadId.** [dotnet/runtime#91232](https://github.com/dotnet/runtime/pull/91232) is fun, in a “why didn’t we already do this” sort of way. `Thread.ManagedThreadId` is implemented as an internal call (an FCALL) into the runtime, resulting in a call to `ThreadNative::GetManagedThreadId`, which in turn reads the thread object’s `m_ManagedThreadId` field. At least, that’s the field in the C definition of the object. The managed `Thread` object has corresponding fields at the exact location that are available for the C# code to use, in this case `_managedThreadId`. So what did this PR do? It removed those complicated gymnastics and just made the whole implementation be `public int ManagedThreadId => _managedThreadId`. (It’s worth noting, though, that `Thread.CurrentThread.ManagedThreadId` was already previously recognized specially by the JIT, so this is only relevant when accessing the `ManagedThreadId` from some other `Thread` instance.) The main benefit of this is avoiding the extra function call, as the FCALL can’t be inlined.
    
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [DisassemblyDiagnoser]
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            private Thread _thread = Thread.CurrentThread;
        
            [Benchmark]
            public int GetID() => _thread.ManagedThreadId;
        }
    
        // .NET 8
        ; Tests.GetID()
               mov       rdi,[rdi+8]
               cmp       [rdi],edi
               jmp       near ptr System.Threading.Thread.get_ManagedThreadId()
        ; Total bytes of code 11
        **Extern method**
        System.Threading.Thread.get_ManagedThreadId()
        
        // .NET 9
        ; Tests.GetID()
               mov       rax,[rdi+8]
               mov       eax,[rax+34]
               ret
        ; Total bytes of code 8
    
*   **Ports to NativeAOT.** Previous releases of .NET enabled inlining the fast path of thread-local state (TLS) access on coreclr. With [dotnet/runtime#104282](https://github.com/dotnet/runtime/pull/104282), [dotnet/runtime#89472](https://github.com/dotnet/runtime/pull/89472), and [dotnet/runtime#97910](https://github.com/dotnet/runtime/pull/97910), this improvement comes to NativeAOT as well. Similarly, [dotnet/runtime#103675](https://github.com/dotnet/runtime/pull/103675) ports coreclr’s “yield normalization” implementation to NativeAOT; this is in support of enabling the runtime to measure the cost of various `pause` instructions, which can then be used as part of tuning spinning and spin waiting.
*   **Startup time.** Performance improvements related to threading are generally about steady-state throughput improvements, e.g. reducing synchronization costs while processing requests. That’s what makes [dotnet/runtime#106724](https://github.com/dotnet/runtime/pull/106724) from [@harisokanovic](https://github.com/harisokanovic) so interesting, in that it’s instead about reducing startup overheads of a process using .NET on Linux. The GC uses the equivalent of a process-wide memory barrier (also exposed publicly as `Interlocked.MemoryBarrierProcessWide`) to ensure that all threads involved in a collection see a consistent state. On Linux, implementing this method efficiently involves using the `membarrier` system call with `MEMBARRIER_CMD_PRIVATE_EXPEDITED`, and using that requires the same syscall to have been made earlier on with `MEMBARRIER_CMD_REGISTER_PRIVATE_EXPEDITED`, which really means doing so at startup. However, the Linux kernel has some optimizations that make this registration a lot cheaper to use when there’s only one thread in the process. The way it was being used in .NET previously guaranteed there would be multiple. This PR changed where this initialization was performed in order to maximize the possibility of there only being the single thread in the process, which in turn makes startup faster. The improvement was upwards of 10ms on various systems on which it was measured, which is a large percentage of a .NET process’ startup overhead on Linux.

Reflection
----------

Reflection is a very powerful (though sometimes overused) capability of .NET that enables code to load and introspect .NET assemblies and invoke their functionality. It is used in all manner of library and application, including by the core .NET libraries themselves, and it’s important that we continue to find ways to reduce the overheads associated with reflection.

Several PRs in .NET 9 whittle away at some of the allocation overheads in reflection. [dotnet/runtime#92310](https://github.com/dotnet/runtime/pull/92310) and [dotnet/runtime#93115](https://github.com/dotnet/runtime/pull/93115) avoid some defensive array copies by instead handing around `ReadOnlySpan<T>` instances, while [dotnet/runtime#95952](https://github.com/dotnet/runtime/pull/95952) removed a use of `string.Split` that turned out to only be used with constants and thus could be replaced by just manually splitting those constants. But a more interesting and impactful addition comes from [dotnet/runtime#97683](https://github.com/dotnet/runtime/pull/97683), which added an allocation-free way to get the invocation list from a delegate. Delegates in .NET are “multicast,” meaning a single delegate instance might actually represent multiple methods to be invoked; this is how .NET events are implemented. If I invoke a delegate, the delegate implementation handles invoking each constituent method, sequentially, in turn. But what if I want to customize the invocation logic? Maybe I want to wrap each individual method in a try/catch, or maybe I want to track the return values from all of the methods rather than just the last, or some such behavior. To achieve that, delegates expose a way to get an array of delegates, one for each method that’s part of the original. So, if I have:

    Action action = () => Console.Write("A ");
    action += () => Console.Write("B ");
    action += () => Console.Write("C ");
    action();

that’ll print out `"A B C "`, and if I have:

    Action action = () => Console.Write("A ");
    action += () => Console.Write("B ");
    action += () => Console.Write("C ");
    
    Delegate[] actions = action.GetInvocationList();
    for (int i = 0; i < actions.Length; ++i)
    {
        Console.Write($"{i}: ");
        ((Action)actions[i])();
        Console.WriteLine();
    }

that’ll print out:

    0: A
    1: B
    2: C

However, that `GetInvocationList` needs to allocate. Now in .NET 9, there’s the new `Delegate.EnumerateInvocationList<TDelegate>` method, which returns a `struct`\-based enumerable for iterating through the delegates rather than needing to allocate a new array to store them all.

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private Action _action;
        private int _count;
    
        [GlobalSetup]
        public void Setup()
        {
            _action = () => _count++;
            _action += () => _count += 2;
            _action += () => _count += 3;
        }
    
        [Benchmark(Baseline = true)]
        public void GetInvocationList()
        {
            foreach (Action action in _action.GetInvocationList())
            {
                action();
            }
        }
    
        [Benchmark]
        public void EnumerateInvocationList()
        {
            foreach (Action action in Delegate.EnumerateInvocationList(_action))
            {
                action();
            }
        }
    }

Method

Mean

Ratio

Allocated

Alloc Ratio

GetInvocationList

32.11 ns

1.00

48 B

1.00

EnumerateInvocationList

11.07 ns

0.34

–

0.00

Reflection is particularly important with libraries involved in dependency injection, where object construction is frequently done in a more dynamic fashion. `ActivatorUtilities.CreateInstance` plays a key role there, and has also seen improvements from allocation reduction. [dotnet/runtime#99383](https://github.com/dotnet/runtime/pull/99383), in particular, helped to significantly reduce allocation by employing the `ConstructorInvoker` type introduced in .NET 8, and by piggybacking on the changes from [dotnet/runtime#99175](https://github.com/dotnet/runtime/pull/99175) to cut down on the number of constructors it needs to examine.

    // Add a <PackageReference Include="Microsoft.Extensions.DependencyInjection" Version="8.0.0" /> to the csproj.
    // dotnet run -c Release -f net8.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Configs;
    using BenchmarkDotNet.Environments;
    using BenchmarkDotNet.Jobs;
    using BenchmarkDotNet.Running;
    using Microsoft.Extensions.DependencyInjection;
    
    var config = DefaultConfig.Instance
        .AddJob(Job.Default.WithRuntime(CoreRuntime.Core80)
            .WithNuGet("Microsoft.Extensions.DependencyInjection", "8.0.0")
            .WithNuGet("Microsoft.Extensions.DependencyInjection.Abstractions", "8.0.1").AsBaseline())
        .AddJob(Job.Default.WithRuntime(CoreRuntime.Core90)
            .WithNuGet("Microsoft.Extensions.DependencyInjection", "9.0.0-rc.1.24431.7")
            .WithNuGet("Microsoft.Extensions.DependencyInjection.Abstractions", "9.0.0-rc.1.24431.7"));
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args, config);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD", "NuGetReferences")]
    public class Tests
    {
        private IServiceProvider _serviceProvider = new ServiceCollection().BuildServiceProvider();
    
        [Benchmark]
        public MyClass Create() => ActivatorUtilities.CreateInstance<MyClass>(_serviceProvider, 1, 2, 3);
    
        public class MyClass
        {
            public MyClass() { }
            public MyClass(int a) { }
            public MyClass(int a, int b) { }
            [ActivatorUtilitiesConstructor]
            public MyClass(int a, int b, int c) { }
        }
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

Create

.NET 8.0

163.60 ns

1.00

288 B

1.00

Create

.NET 9.0

83.46 ns

0.51

144 B

0.50

The aforementioned `ConstructorInvoker`, along with a `MethodInvoker`, was introduced in .NET 8 as a way to cache first-use information to enable all subsequent operations to be much faster. Without introducing a new public `FieldInvoker`, [dotnet/runtime#98199](https://github.com/dotnet/runtime/pull/98199) is able to achieve similar levels of speedup for field access via a `FieldInfo` by employing an internal `FieldAccessor` that’s cached onto the `FieldInfo` object ([dotnet/runtime#92512](https://github.com/dotnet/runtime/pull/92512) also helped here by moving some native runtime implementations back up into C#). Varying levels of large speedups are achieved depending on the exact nature of the field being accessed.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Reflection;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD", "NuGetReferences")]
    public class Tests
    {
        private static object s_staticReferenceField = new object();
        private object _instanceReferenceField = new object();
        private static int s_staticValueField = 1;
        private int _instanceValueField = 2;
        private object _obj = new();
    
        private FieldInfo _staticReferenceFieldInfo = typeof(Tests).GetField(nameof(s_staticReferenceField), BindingFlags.NonPublic | BindingFlags.Static)!;
        private FieldInfo _instanceReferenceFieldInfo = typeof(Tests).GetField(nameof(_instanceReferenceField), BindingFlags.NonPublic | BindingFlags.Instance)!;
        private FieldInfo _staticValueFieldInfo = typeof(Tests).GetField(nameof(s_staticValueField), BindingFlags.NonPublic | BindingFlags.Static)!;
        private FieldInfo _instanceValueFieldInfo = typeof(Tests).GetField(nameof(_instanceValueField), BindingFlags.NonPublic | BindingFlags.Instance)!;
    
        [Benchmark] public object? GetStaticReferenceField() => _staticReferenceFieldInfo.GetValue(null);
        [Benchmark] public void SetStaticReferenceField() => _staticReferenceFieldInfo.SetValue(null, _obj);
    
        [Benchmark] public object? GetInstanceReferenceField() => _instanceReferenceFieldInfo.GetValue(this);
        [Benchmark] public void SetInstanceReferenceField() => _instanceReferenceFieldInfo.SetValue(this, _obj);
    
        [Benchmark] public int GetStaticValueField() => (int)_staticValueFieldInfo.GetValue(null)!;
        [Benchmark] public void SetStaticValueField() => _staticValueFieldInfo.SetValue(null, 3);
    
        [Benchmark] public int GetInstanceValueField() => (int)_instanceValueFieldInfo.GetValue(this)!;
        [Benchmark] public void SetInstanceValueField() => _instanceValueFieldInfo.SetValue(this, 4);
    }

Method

Runtime

Mean

Ratio

GetStaticReferenceField

.NET 8.0

24.839 ns

1.00

GetStaticReferenceField

.NET 9.0

1.720 ns

0.07

SetStaticReferenceField

.NET 8.0

41.025 ns

1.00

SetStaticReferenceField

.NET 9.0

6.964 ns

0.17

GetInstanceReferenceField

.NET 8.0

29.595 ns

1.00

GetInstanceReferenceField

.NET 9.0

5.960 ns

0.20

SetInstanceReferenceField

.NET 8.0

31.753 ns

1.00

SetInstanceReferenceField

.NET 9.0

9.577 ns

0.30

GetStaticValueField

.NET 8.0

43.847 ns

1.00

GetStaticValueField

.NET 9.0

36.011 ns

0.82

SetStaticValueField

.NET 8.0

39.462 ns

1.00

SetStaticValueField

.NET 9.0

10.396 ns

0.26

GetInstanceValueField

.NET 8.0

45.125 ns

1.00

GetInstanceValueField

.NET 9.0

39.104 ns

0.87

SetInstanceValueField

.NET 8.0

36.664 ns

1.00

SetInstanceValueField

.NET 9.0

13.571 ns

0.37

Of course, if you can avoid using these more expensive reflection approaches in the first place, that’s very desirable. One reason for using reflection is to access private members of other types, and while that’s a scary thing to do and generally something to be avoided, there are valid cases for it where having an efficient solution is highly desirable. .NET 8 added such a mechanism in `[UnsafeAccessor]`, which enables a type to declare a method that effectively serves as direct access to a member of another type. So, for example, with this:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Reflection;
    using System.Runtime.CompilerServices;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD", "NuGetReferences")]
    public class Tests
    {
        private MyClass _myClass = new MyClass(new List<int>() { 1, 2, 3 });
        private FieldInfo _fieldInfo = typeof(MyClass).GetField("_list", BindingFlags.NonPublic | BindingFlags.Instance)!;
    
        private static class Accessors
        {
            [UnsafeAccessor(UnsafeAccessorKind.Field, Name = "_list")]
            public static extern ref object GetList(MyClass myClass);
        }
    
        [Benchmark(Baseline = true)]
        public object WithFieldInfo() => _fieldInfo.GetValue(_myClass)!;
    
        [Benchmark]
        public object WithUnsafeAccessor() => Accessors.GetList(_myClass);
    }
    
    public class MyClass(object list)
    {
        private object _list = list;
    }

I get this:

Method

Runtime

Mean

Ratio

WithFieldInfo

.NET 8.0

27.5299 ns

1.00

WithFieldInfo

.NET 9.0

4.0789 ns

0.15

WithUnsafeAccessor

.NET 8.0

0.5005 ns

0.02

WithUnsafeAccessor

.NET 9.0

0.5499 ns

0.02

However, in .NET 8, this mechanism could only be used with non-generic members. Now in .NET 9, thanks to [dotnet/runtime#99468](https://github.com/dotnet/runtime/pull/99468) and [dotnet/runtime#99830](https://github.com/dotnet/runtime/issues/99830), this capability now extends to generics, as well.

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Reflection;
    using System.Runtime.CompilerServices;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD", "NuGetReferences")]
    public class Tests
    {
        private MyClass<int> _myClass = new MyClass<int>(new List<int>() { 1, 2, 3 });
        private FieldInfo _fieldInfo = typeof(MyClass<int>).GetField("_list", BindingFlags.NonPublic | BindingFlags.Instance)!;
        private static class Accessors<T>
        {
            [UnsafeAccessor(UnsafeAccessorKind.Field, Name = "_list")]
            public static extern ref List<T> GetList(MyClass<T> myClass);
        }
    
        [Benchmark(Baseline = true)]
        public List<int> WithFieldInfo() => (List<int>)_fieldInfo.GetValue(_myClass)!;
    
        [Benchmark]
        public List<int> WithUnsafeAccessor() => Accessors<int>.GetList(_myClass);
    }
    
    public class MyClass<T>(List<T> list)
    {
        private List<T> _list = list;
    }

Method

Mean

Ratio

WithFieldInfo

4.4251 ns

1.00

WithUnsafeAccessor

0.5147 ns

0.12

Parsing that occurs as part of reflection, and in particular as part of type names, was also improved as part of some work to consolidate type name parsing into a reusable component. [dotnet/runtime#100094](https://github.com/dotnet/runtime/pull/100094)‘s primary purpose wasn’t to improve performance, but it ended up doing so, anyway.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        public Type? Parse() =>
            Type.GetType("System.Collections.Generic.Dictionary`2[" +
                             "[System.Collections.Generic.List`1[" +
                                "[System.Int32, System.Private.CoreLib, Version=8.0.0.0, Culture=neutral, PublicKeyToken=7cec85d7bea7798e]], " +
                                "System.Private.CoreLib, Version=8.0.0.0, Culture=neutral, PublicKeyToken=7cec85d7bea7798e]," +
                             "[System.Collections.Generic.List`1[" +
                                "[System.String, System.Private.CoreLib, Version=8.0.0.0, Culture=neutral, PublicKeyToken=7cec85d7bea7798e]], " +
                                "System.Private.CoreLib, Version=8.0.0.0, Culture=neutral, PublicKeyToken=7cec85d7bea7798e]], " +
                             "System.Private.CoreLib, Version=8.0.0.0, Culture=neutral, PublicKeyToken=7cec85d7bea7798e");
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

Parse

.NET 8.0

7.590 us

1.00

5.03 KB

1.00

Parse

.NET 9.0

6.361 us

0.84

4.73 KB

0.94

And then there are more intrinsics. In compiler speak, an “intrinsic” is something the compiler has “intrinsic” knowledge of, a fancy way of saying it’s something the compiler implicitly knows about. This typically manifests as a method whose implementation is provided by the compiler, sometimes always or sometimes based on certain conditions. For example, `string.Equals` is attributed as `[Intrinsic]`: it has its own fully-functional implementation, but if the JIT sees that at least one of the inputs is a constant string, the JIT may emit its own optimized implementation for `Equals` that unrolls and vectorizes the comparison based on the exact value being compared.

Several new members became intrinsics in .NET 9. [dotnet/runtime#96226](https://github.com/dotnet/runtime/pull/96226) turns `typeof(T).IsPrimitive` into an intrinsic, which allows the JIT to supply a constant replacement for the expression, which in turn allows branches to be eliminated and possibly whole swaths of then dead code to follow. For example, as part of its code path for moving to the next value, `Parallel.ForAsync` has a code path that looks like this:

    if (typeof(T).IsPrimitive)
    {
        UseInterlockedCompareExchangeToAdvance();
    }
    else
    {
        UseALockAroundAReadIncrementStoreToAdvance();
    }

With `IsPrimitive` as an intrinsic, that `if`/`else` will reduce entirely to either:

    UseInterlockedCompareExchangeToAdvance();

or

    UseALockAroundAReadIncrementStoreToAdvance();

based on the nature of `T`.

`typeof(T).IsGenericType` and `typeof(T).GetGenericTypeDefinition` were also made into intrinsics, by [dotnet/runtime#99555](https://github.com/dotnet/runtime/pull/99555) and [dotnet/runtime#103528](https://github.com/dotnet/runtime/pull/103528), respectively. Imagine code like that in ASP.NET where it wants to special-case APIs that return `Task<T>` vs `ValueTask<T>` vs `IAsyncEnumerable<T>` vs `T` vs other types; it’ll often use members like `IsGenericType` and `GetGenericTypeDefinition` (which will throw an exception if `IsGenericType` is `false`) to determine whether a concrete instantiation of a generic type is the one in question. With this benchmark:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        public bool Test() => IsTaskT<Task<string>>();
    
        private static bool IsTaskT<T>() =>
            typeof(T).IsGenericType &&
            typeof(T).GetGenericTypeDefinition() == typeof(Task<>);
    }

on .NET 8 we end up with over 250 bytes of assembly code for implementing this operation. On .NET 9, we get just this:

    ; Tests.Test()
           mov       eax,1
           ret
    ; Total bytes of code 6

The magic of intrinsics.

Numerics
--------

### Primitive Types

The core data types in .NET sit at the very bottom of the stack and are used everywhere. It’s thus a desire every release to whittle away at any overheads we can avoid. .NET 9 is no exception, where a multitude of PRs have gone into reducing overheads of various operations on these core types.

Consider `DateTime`. When it comes to performance optimization, we typically focus on the happy path, on the “hot path,” on the successful path. Exceptions already add significant expense to error paths, and are intended to be “exceptional” and relatively rare, and so we generally don’t worry about an extra operation here or an extra allocation there. But, sometimes, one type’s error path is another type’s success path. This is especially true with `Try` methods, where failure is conveyed via a `bool` rather than with an expensive exception. As part of profiling a commonly-used .NET library, the profiler highlighted some unexpected allocations coming from `DateTime` handling, unexpected because we’ve spent a lot of time over the years trying to eliminate allocations in this area of the code. The allocation, it turned out, was occurring on an error path, both with `DateTime.Parse` when an exception would be thrown, but _also_ with `DateTime.TryParse` when `false` would be returned. As it happened, deep in the call tree where parsing work is going on, if an error is encountered, the code stores information about the failure (e.g. a `ParseFailureKind` enum value); after unwinding the call stack back to the public method, `Parse` uses that to throw an appropriately-detailed exception, while `TryParse` just ignores it and returns `false`. But the way the code was written, that enum value would end up getting boxed when it was stored, resulting in an allocation as part of `TryParse` returning `false`. The consuming library was using `TryParse` on a bunch of different data primitive types as part of interpreting the data, e.g.

    if (int.TryParse(value, out int parsedInt32)) { ... }
    else if (DateTime.TryParse(value, out DateTime parsedDateTime)) { ... }
    else if (double.TryParse(value, out double parsedDouble)) { ... }
    else if ...

such that _its_ success path might include the failure path from some number of these primitives’ `TryParse` methods. [dotnet/runtime#91303](https://github.com/dotnet/runtime/pull/91303) tweaked how the information is stored to avoid that boxing, while also reducing a bit of additional overhead along the way.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD", "input")]
    public class Tests
    {
        [Benchmark]
        [Arguments("hello")]
        public bool TryParse(string input) => DateTime.TryParse(input, out _);
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

TryParse

.NET 8.0

31.95 ns

1.00

24 B

1.00

TryParse

.NET 9.0

25.96 ns

0.81

–

0.00

Both `DateTime` and `TimeSpan` also saw parsing and formatting gains from [dotnet/runtime#101640](https://github.com/dotnet/runtime/pull/101640) from [@lilinus](https://github.com/lilinus). The PR takes advantage of an existing internal `CountDigits` helper that was optimized in .NET 8 as part of integer parsing; it employs a lookup table to compute the number of digits that will be required for a number, doing so in just a few instructions. And it replaces a `switch` with a lookup table as part of computing powers of ten, replacing a method like `Pow10_Old` in this benchmark with one more like `Pow10_New`:

    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD", "input")]
    public class Tests
    {
        private int _pow = 3;
    
        [Benchmark(Baseline = true)]
        public long Pow10_Old() =>
            _pow switch
            {
                0 => 1,
                1 => 10,
                2 => 100,
                3 => 1000,
                4 => 10000,
                5 => 100000,
                6 => 1000000,
                _ => 10000000, // _pow will never be greater than 7
            };
    
        [Benchmark]
        public long Pow10_New()
        {
            ReadOnlySpan<int> powersOfTen =
            [
                1,
                10,
                100,
                1000,
                10000,
                100000,
                1000000,
                10000000, // _pow will never be greater than 7
            ];
            return powersOfTen[_pow];
        }
    }

The JIT is able to do a bit better job with the latter, for the former producing:

    ; Tests.Pow10_Old()
           push      rbp
           mov       rbp,rsp
    M00_L00:
           mov       ecx,[rdi+8]
           cmp       ecx,3
           jne       short M00_L02
           mov       edx,3E8
    M00_L01:
           movsxd    rax,edx
           pop       rbp
           ret
    M00_L02:
           cmp       ecx,6
           ja        short M00_L03
           mov       edx,ecx
           lea       rax,[7F3D29A690E8]
           mov       eax,[rax+rdx*4]
           lea       rcx,[M00_L00]
           add       rax,rcx
           jmp       rax
    M00_L03:
           mov       edx,989680
           jmp       short M00_L01
           mov       edx,0F4240
           jmp       short M00_L01
           mov       edx,186A0
           jmp       short M00_L01
           mov       edx,2710
           jmp       short M00_L01
           mov       edx,64
           jmp       short M00_L01
           mov       edx,0A
           jmp       short M00_L01
           mov       edx,1
           jmp       short M00_L01
    ; Total bytes of code 100

but for the latter producing:

    ; Tests.Pow10_New()
           push      rax
           mov       eax,[rdi+8]
           cmp       eax,8
           jae       short M00_L00
           mov       rcx,7F3CC0AE6018
           movsxd    rax,dword ptr [rcx+rax*4]
           add       rsp,8
           ret
    M00_L00:
           call      CORINFO_HELP_RNGCHKFAIL
           int       3
    ; Total bytes of code 34

The net result is a nice improvement to these operations, e.g.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private string _input = TimeSpan.FromMilliseconds(12345.6789).ToString();
    
        [Benchmark]
        public TimeSpan Parse() => TimeSpan.Parse(_input);
    }

Method

Runtime

Mean

Ratio

Parse

.NET 8.0

137.55 ns

1.00

Parse

.NET 9.0

117.78 ns

0.86

Various operations on the primitive types were also improved across a plethora of PRs:

*   **Round.** [dotnet/runtime#98186](https://github.com/dotnet/runtime/pull/98186) from [@MichalPetryka](https://github.com/MichalPetryka) optimized the various `Math.Round` and `MathF.Round` overloads (which are the same implementations as `double.Round` and `float.Round`).
    
        // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            private double _value = 12345.6789;
        
            [Benchmark]
            public double RoundDigits() => Math.Round(_value, 2);
        }
    
    Method
    
    Runtime
    
    Mean
    
    Ratio
    
    RoundDigits
    
    .NET 8.0
    
    1.6930 ns
    
    1.00
    
    RoundDigits
    
    .NET 9.0
    
    0.3496 ns
    
    0.21
    
*   **SinCos.** [dotnet/runtime#103724](https://github.com/dotnet/runtime/pull/103724) updated `Math.SinCos` and `MathF.SinCos` to use the internal `RuntimeHelpers.IsKnownConstant` intrinsic. This method enables code in `CoreLib` to check whether the argument to the method is coming in as a constant the JIT can see, at which point the implementation might choose to do something special. In this case, the `Sin` and `Cos` functions are already capable of producing constant results for constant input, so rather than doing the normal implementation, which tries to reuse most of the computation that’s shared between `Sin` and `Cos`, it instead just calls to each, knowing that the constant input for each will result in a constant output overall.
    
        // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [DisassemblyDiagnoser(maxDepth: 0)]
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            [Benchmark]
            public float Sum() => SumSinCos(123.456f);
        
            private float SumSinCos(float f)
            {
                (float sin, float cos) = MathF.SinCos(f);
                return sin + cos;
            }
        }
    
    Method
    
    Runtime
    
    Mean
    
    Ratio
    
    Code Size
    
    Sum
    
    .NET 8.0
    
    5.2719 ns
    
    1.000
    
    46 B
    
    Sum
    
    .NET 9.0
    
    0.0177 ns
    
    0.003
    
    9 B
    
    In cases like this, it’s helpful to pay attention to the warnings BenchmarkDotNet issues:
    
        // * Warnings *
        ZeroMeasurement
          Tests.Sum: Runtime=.NET 9.0, Toolchain=net9.0 -> The method duration is indistinguishable from the empty method duration
    
    The .NET 9 run is indistinguishable from an empty method because it _is_ an empty method, or at least a method that just returns a constant. We can see that by looking at the disassembly. The .NET 8 code has a few moves and loads and then calls to `SinCos`:
    
        ; Tests.Sum()
               push      rax
               vzeroupper
               vmovss    xmm0,dword ptr [7F7686979610]
               lea       rdi,[rsp+4]
               lea       rsi,[rsp]
               call      System.MathF.SinCos(Single, Single*, Single*)
               vmovss    xmm0,dword ptr [rsp+4]
               vmovss    xmm1,dword ptr [rsp]
               vaddss    xmm0,xmm0,xmm1
               add       rsp,8
               ret
        ; Total bytes of code 46
    
    In contrast, here’s .NET 9:
    
        ; Tests.Sum()
               vmovss    xmm0,dword ptr [7F4D10FD9080]
               ret
        ; Total bytes of code 9
    
    It’s simply loading a value and returning it, since the whole operation compiled down to a constant.
    
*   **Enum.{Try}Parse.** Interop scenarios drove the introduction of two new `RuntimeHelpers` APIs, `SizeOf` in [dotnet/runtime#100618](https://github.com/dotnet/runtime/pull/100618) and `Box` in [dotnet/runtime#100561](https://github.com/dotnet/runtime/pull/100561). But, [dotnet/runtime#100846](https://github.com/dotnet/runtime/pull/100846) was then able to utilize these APIs to optimize the implementation of the non-generic `Enum.Parse` and `Enum.TryParse` overloads, which give back the parsed enum value as `object`. This is a special kind of boxing, because the parse methods internally extract a numerical value but then need the boxed object to be of the enum type (rather than the numerical type) specified via the `Type` argument.
    
        // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            private string _input = "Monday";
        
            [Benchmark]
            public object Parse() => Enum.Parse(typeof(DayOfWeek), _input);
        }
    
    Method
    
    Runtime
    
    Mean
    
    Ratio
    
    Parse
    
    .NET 8.0
    
    62.01 ns
    
    1.00
    
    Parse
    
    .NET 9.0
    
    28.13 ns
    
    0.45
    
*   **Integer Division.** Consider this benchmark:
    
        // dotnet run -c Release -f net8.0 --filter "*"
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [DisassemblyDiagnoser]
        [MemoryDiagnoser(false)]
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            [Benchmark]
            [Arguments(5)]
            public uint DivideBy4_UInt32(uint value) => value / 4;
        
            [Benchmark]
            [Arguments(5)]
            public int DivideBy4_Int32(int value) => value / 4;
        }
    
    With the `uint`\-based example, dividing by 4 is already optimized into a simple right shift, since for a `uint`, `value / 4` and `value >> 2` are functionally equivalent. However, that’s not the case for an `int`, or at least, not always. For a non-negative `int`, the same optimization could be employed, but if the `int` is negative, for some values switching from `value / 4` to `value >> 2` would be functionally incorrect. Consider `-5 / 4`… the answer is `-1`. But `-5 >> 2` is `-2`. Oops. So when you look at the assembly code for the `int` case (here on .NET 8), it’s more complex:
    
        ; Tests.DivideBy4_UInt32(UInt32)
               mov       eax,esi
               shr       eax,2
               ret
        ; Total bytes of code 6
        
        ; Tests.DivideBy4_Int32(Int32)
               mov       eax,esi
               sar       eax,1F
               and       eax,3
               add       eax,esi
               sar       eax,2
               ret
        ; Total bytes of code 14
    
    Given that, you might hope that if the compiler could prove that the `int` was non-negative, it could still employ the simpler shifting:
    
        // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [DisassemblyDiagnoser]
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            [Benchmark]
            [Arguments(5)]
            public int DivideBy4_Int32(int value) => value < 4 ? 0 : value / 4;
        }
    
    But alas, on .NET 8, we still get:
    
        ; Tests.DivideBy4_Int32(Int32)
               cmp       esi,4
               jl        short M00_L00
               mov       eax,esi
               sar       eax,1F
               and       eax,3
               add       eax,esi
               sar       eax,2
               ret
        M00_L00:
               xor       eax,eax
               ret
        ; Total bytes of code 22
    
    On .NET 9, [dotnet/runtime#94347](https://github.com/dotnet/runtime/pull/94347) updates the JIT for exactly that, replacing signed division with unsigned division if it can prove that both the numerator and denominator are non-negative.
    
        ; Tests.DivideBy4_Int32(Int32)
               cmp       esi,4
               jl        short M00_L00
               mov       eax,esi
               shr       eax,2
               ret
        M00_L00:
               xor       eax,eax
               ret
        ; Total bytes of code 14
    
*   **Nullable.** Several optimizations went into making `Nullable<T>` cheaper, in particular when used with generics. Consider this benchmark:
    
        // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        using System.Runtime.CompilerServices;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [DisassemblyDiagnoser]
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            [Benchmark]
            public void TestStruct() => Dispose<List.Enumerator>(default);
        
            [Benchmark]
            public void TestNullableStruct() => Dispose<List<int>.Enumerator?>(default);
        
            [MethodImpl(MethodImplOptions.AggressiveInlining)]
            private static void Dispose<T>(T t)
            {
                if (t is IDisposable)
                {
                    ((IDisposable)t).Dispose();
                }
            }
        }
    
    We have an unconstrained generic method `Dispose` whose job it is to cast the argument to `IDisposable` and invoke its `Dispose`. While such an operation would seemingly box if `T` were a value type, for a long time now the JIT has had optimizations that end up eliminating that boxing. In the case of the `List<T>.Enumerator`, its `Dispose` implementation is a nop, so with `Dispose<T>` getting inlined, no boxing, and the `IDisposable.Dispose` implementation nop’ing, this whole method is a nop (on both .NET 8 and .NET 9):
    
        ; Tests.TestStruct()
               ret
        ; Total bytes of code 1
    
    That’s unfortunately not the case for `TestNullableStruct`. The _only_ difference between `TestStruct` and `TestNullableStruct` is that pesky `?` in the generic type argument, which means `T` will be a `Nullable<List<int>.Enumerator>` rather than `List<int>.Enumerator`. That complicates things. `Nullable<T>` is very special, with a boxed nullable implementing the same interfaces as does the underlying struct, but it ends up being very hard for the JIT to deal with. On .NET 8, we end up with this assembly:
    
        ; Tests.TestNullableStruct()
               push      rbp
               sub       rsp,20
               lea       rbp,[rsp+20]
               vxorps    xmm8,xmm8,xmm8
               vmovdqa   xmmword ptr [rbp-20],xmm8
               vmovdqa   xmmword ptr [rbp-10],xmm8
               cmp       byte ptr [rbp-20],0
               jne       short M00_L01
        M00_L00:
               add       rsp,20
               pop       rbp
               ret
        M00_L01:
               lea       rsi,[rbp-20]
               mov       rdi,offset MT_System.Nullable`1[[System.Collections.Generic.List`1+Enumerator[[System.Int32, System.Private.CoreLib]], System.Private.CoreLib]]
               call      CORINFO_HELP_BOX_NULLABLE
               mov       rsi,rax
               mov       rdi,offset MT_System.IDisposable
               call      qword ptr [7F178F2543C0]; System.Runtime.CompilerServices.CastHelpers.ChkCastInterface(Void*, System.Object)
               mov       rdi,rax
               mov       r11,7F178E5904C0
               call      qword ptr [r11]
               jmp       short M00_L00
        ; Total bytes of code 93
    
    That’s a whole lot more than a `ret`. Thankfully, for .NET 9, [dotnet/runtime#95764](https://github.com/dotnet/runtime/pull/95764) makes this better by optimizing `castclass` for `Nullable<T>`:
    
        ; Tests.TestNullableStruct()
               sub       rsp,28
               xor       eax,eax
               mov       [rsp+8],rax
               vxorps    xmm8,xmm8,xmm8
               vmovdqa   xmmword ptr [rsp+10],xmm8
               mov       [rsp+20],rax
               cmp       byte ptr [rsp+8],0
               jne       short M00_L01
        M00_L00:
               add       rsp,28
               ret
        M00_L01:
               lea       rsi,[rsp+8]
               mov       rdi,offset MT_System.Nullable`1[[System.Collections.Generic.List`1+Enumerator[[System.Int32, System.Private.CoreLib]], System.Private.CoreLib]]
               call      CORINFO_HELP_BOX_NULLABLE
               movsx     rax,byte ptr [rax+8]
               jmp       short M00_L00
        ; Total bytes of code 66
    
    We still have the `call` to `CORINFO_HELP_BOX_NULLABLE`, but the relatively expensive `call` to `ChkCastInterface` is now gone. While this may seem a little corner case, it actually shows up in well-known places. For example:
    
        // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            private int? _value = 42;
        
            [Benchmark]
            public string Interpolate() => $"{_value}";
        }
    
    Here we’re just doing string interpolation, using a nullable value type as one of the arguments. The `DefaultInterpolatedStringHandler` has a generic `AppendFormatted` method which this will end up using, passing the `Nullable<int>` as its argument, and that method employs similar patterns of type testing for an interface and using it if it’s available. And as a result, this optimization can have a measurable impact on such interpolated string use:
    
    Method
    
    Runtime
    
    Mean
    
    Ratio
    
    Interpolate
    
    .NET 8.0
    
    78.12 ns
    
    1.00
    
    Interpolate
    
    .NET 9.0
    
    62.95 ns
    
    0.81
    
    Another `Nullable<T>`\-related optimization is [dotnet/runtime#95711](https://github.com/dotnet/runtime/pull/95711), which ends up avoiding boxing for some forms of type testing. Consider this:
    
        // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [DisassemblyDiagnoser]
        [MemoryDiagnoser(false)]
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            private int? _value = 42;
        
            [Benchmark]
            public bool Test() => IsInt(_value);
        
            private static bool IsInt<T>(T value) => value is int;
        }
    
    This should be relatively straightforward: the JIT can see that `T` is a `Nullable<int>`, and then whether it satisfies the type test is a question of whether the value is `null` or not, since if it’s `null`, it’s not an `int`, and if it’s not `null`, it is an `int`. Unfortunately, on .NET 8, not so much:
    
        ; Tests.Test()
               push      rbp
               sub       rsp,10
               lea       rbp,[rsp+10]
               mov       rsi,[rdi+8]
               mov       [rbp-8],rsi
               lea       rsi,[rbp-8]
               mov       rdi,offset MT_System.Nullable`1[[System.Int32, System.Private.CoreLib]]
               call      CORINFO_HELP_BOX_NULLABLE
               test      rax,rax
               je        short M00_L00
               mov       rcx,offset MT_System.Int32
               xor       edx,edx
               cmp       [rax],rcx
               cmovne    rax,rdx
        M00_L00:
               test      rax,rax
               setne     al
               movzx     eax,al
               add       rsp,10
               pop       rbp
               ret
        ; Total bytes of code 76
    
    In fact, we can see it’s using `CORINFO_HELP_BOX_NULLABLE` to `box` the `Nullable<int>`, which means we actually end up with an allocation as part of this type test. And that’s visible in the benchmark results:
    
    Method
    
    Runtime
    
    Mean
    
    Ratio
    
    Code Size
    
    Allocated
    
    Alloc Ratio
    
    Test
    
    .NET 8.0
    
    39.1567 ns
    
    1.000
    
    76 B
    
    24 B
    
    1.00
    
    Test
    
    .NET 9.0
    
    0.0006 ns
    
    0.000
    
    5 B
    
    –
    
    0.00
    
    On .NET 9, it ends up being what we thought it should be, a simple `null` check:
    
        ; Tests.Test()
               movzx     eax,byte ptr [rdi+8]
               ret
        ; Total bytes of code 5
    
    where the result of the method is simply `Nullable<T>.HasValue`.
    
    As a small tangent since we’re talking about optimizing casting, [dotnet/runtime#98284](https://github.com/dotnet/runtime/pull/98284) improves code generation for casts where the JIT can end up seeing that the object being cast is `null` (while you’d probably never explicitly write `if (null is SomeClass)`, you might very well write `if (GetObject() is SomeClass)` were `GetObject()` might get inlined and return `null`, especially if `GetObject()` is virtual and due to dynamic PGO a `null`\-returning override gets inlined).
    
        // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [DisassemblyDiagnoser]
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            [Benchmark]
            public Tests? NullCast() => GetObj() as Tests;
        
            private object? GetObj() => null;
        }
    
    On .NET 8, it doesn’t pay attention to whether it knows that the source will be `null`, but now in .NET 9, it does:
    
        // .NET 8
        ; Tests.NullCast()
               push      rax
               mov       rdi,offset MT_Tests
               xor       esi,esi
               call      qword ptr [7F0457E24360]; System.Runtime.CompilerServices.CastHelpers.IsInstanceOfClass(Void*, System.Object)
               nop
               add       rsp,8
               ret
        ; Total bytes of code 25
        
        // .NET 9
        ; Tests.NullCast()
               push      rax
               xor       eax,eax
               add       rsp,8
               ret
        ; Total bytes of code 8
    
    Back to `Nullable<T>`, [dotnet/runtime#105073](https://github.com/dotnet/runtime/pull/105073) enables the JIT to inline the fast path of the unboxing helper that’s used when extracting a `Nullable<T>` from an `object`. There’s an `CORINFO_HELP_UNBOX_NULLABLE` helper function that’s called to perform the unboxing (e.g. `(int?)o` for some `object o`), but the success path (where the object is either `null` or the boxed target type) is small and it’s worth inlining that.
    
        // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [DisassemblyDiagnoser]
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            private object _o = 42;
        
            [Benchmark]
            public int? Unbox() => (int?)_o;
        }
    
    On .NET 8, we get the following, effectively just a call to `CORINFO_HELP_UNBOX_NULLABLE`:
    
        ; Tests.Unbox()
               push      rax
               mov       rdx,[rdi+8]
               lea       rdi,[rsp]
               mov       rsi,offset MT_System.Nullable`1[[System.Int32, System.Private.CoreLib]]
               call      CORINFO_HELP_UNBOX_NULLABLE
               mov       rax,[rsp]
               add       rsp,8
               ret
        ; Total bytes of code 33
    
    whereas on .NET 9, we get the following, which is creating a default `Nullable<int>` if the object is `null`, or a `Nullable<int>` with the value from the object if it’s a boxed `int`, or calling `CORINFO_HELP_UNBOX_NULLABLE` if it’s something else (in which case we’ll be throwing an exception shortly):
    
        ; Tests.Unbox()
               push      rbp
               sub       rsp,10
               lea       rbp,[rsp+10]
               mov       rdx,[rdi+8]
               test      rdx,rdx
               jne       short M00_L00
               xor       edx,edx
               mov       [rbp-8],rdx
               jmp       short M00_L01
        M00_L00:
               mov       rax,offset MT_System.Int32
               cmp       [rdx],rax
               jne       short M00_L02
               mov       byte ptr [rbp-8],1
               mov       eax,[rdx+8]
               mov       [rbp-4],eax
        M00_L01:
               mov       rax,[rbp-8]
               add       rsp,10
               pop       rbp
               ret
        M00_L02:
               lea       rdi,[rbp-8]
               mov       rsi,offset MT_System.Nullable`1[[System.Int32, System.Private.CoreLib]]
               call      CORINFO_HELP_UNBOX_NULLABLE
               jmp       short M00_L01
        ; Total bytes of code 83
    
    This is one of those cases where you actually want the code to be larger, at least for the micro-benchmark, because the inlining is the purpose and is bringing in more code.
    
    Method
    
    Runtime
    
    Mean
    
    Ratio
    
    Code Size
    
    Unbox
    
    .NET 8.0
    
    6.014 ns
    
    1.00
    
    33 B
    
    Unbox
    
    .NET 9.0
    
    2.854 ns
    
    0.47
    
    83 B
    

### BigInteger

Not exactly a “primitive” type, but in the same ballpark, is `BigInteger`. As with `sbyte`, `short`, `int`, and `long`, `System.Numerics.BigInteger` is an `IBinaryInteger<>` and `ISignedNumber<>`. Unlike those types, which are all of a fixed bit size (8, 16, 32, and 64 bits, respectively), `BigInteger` can represent signed integers with any number of bits (within reason… the current representation allows up to `Array.MaxLength / 64` bits, which means representing numbers up to 2^33,554,432… that’s… big). Such large sizes brings with it performance complexities, and historically `BigInteger` hasn’t been a beacon of high throughput. While there’s still more that can be done (and in fact there are several pending PRs even as I write this), a bunch of nice changes have landed for .NET 9.

[dotnet/runtime#91176](https://github.com/dotnet/runtime/pull/91176) from [@Rob-Hague](https://github.com/Rob-Hague) improved `BigInteger`‘s `byte`\-based constructors (e.g. `public BigInteger(byte[] value)`) by utilizing vectorized operations from `MemoryMarshal` and `BinaryPrimitives`. In particular, a lot of the time spent in these `BigInteger` constructors is in walking the list of bytes, building up integers out of each grouping of four, and storing those into a destination `uint[]`. With spans, however, that whole operation is unnecessary and can be achieved with an optimized `CopyTo` operation (effectively a `memcpy`) with the destination just being that `uint[]` reinterpreted as a span of bytes.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Numerics;
    using System.Security.Cryptography;
    
    BenchmarkSwitcher.FromAssembly(typeof(Program).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private byte[] _bytes;
    
        [GlobalSetup]
        public void Setup()
        {
            _bytes = new byte[10_000];
            new Random(42).NextBytes(_bytes);
        }
    
        [Benchmark]
        public BigInteger NewBigInteger() => new BigInteger(_bytes);
    }

Method

Runtime

Mean

Ratio

NewBigInteger

.NET 8.0

5.886 us

1.00

NewBigInteger

.NET 9.0

1.434 us

0.24

Parsing is another common way of creating `BigInteger`s. [dotnet/runtime#95543](https://github.com/dotnet/runtime/pull/95543) improved the performance of parsing hex and binary-formatted values (this is on top of the .NET 9 addition in [dotnet/runtime#85392](https://github.com/dotnet/runtime/pull/85392) from [@lateapexearlyspeed](https://github.com/lateapexearlyspeed) that added support for the `"b"` format specifier for formatting and parsing `BigInteger` as binary). Previously, parsing would go digit-by-digit, but with the new algorithm, it parses multiple chars at the same time, using a vectorized implementation for larger inputs.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Globalization;
    using System.Numerics;
    
    BenchmarkSwitcher.FromAssembly(typeof(Program).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private string _hex = string.Create(1024, 0, (dest, _) => new Random(42).GetItems<char>("0123456789abcdef", dest));
    
        [Benchmark]
        public BigInteger ParseHex() => BigInteger.Parse(_hex, NumberStyles.HexNumber);
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

ParseHex

.NET 8.0

5,155.5 ns

1.00

5208 B

1.00

ParseHex

.NET 9.0

236.8 ns

0.05

536 B

0.10

This isn’t the first time efforts have been made to improve `BigInteger` parsing. .NET 7, for example, included a change that introduced a new parsing algorithm. The previous algorithm was `O(N^2)` in the number of digits, and the new algorithm had a lower algorithmic complexity, but due to the constants involved was only worthwhile with a larger number of digits. Both algorithms were included, switching between them based on a cut-off of 20,000 digits. As it turns out, with more analysis, that threshold was significantly higher than it needed to be, and [dotnet/runtime#97101](https://github.com/dotnet/runtime/pull/97101) from [@kzrnm](https://github.com/kzrnm) lowered the threshold to a much smaller value (1233). On top of this, [dotnet/runtime#97589](https://github.com/dotnet/runtime/pull/97589) from [@kzrnm](https://github.com/kzrnm) improves parsing further by a) recognizing that the multiplier being used during parsing (shifting down digits to make room for adding in the next set) includes many leading zeros that can be ignored during the operation, and b) trailing zeros when parsing powers of 10 could be calculated more efficiently.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Numerics;
    
    BenchmarkSwitcher.FromAssembly(typeof(Program).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private string _digits = string.Create(2000, 0, (dest, _) => new Random(42).GetItems<char>("0123456789", dest));
    
        [Benchmark]
        public BigInteger ParseDecimal() => BigInteger.Parse(_digits);
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

ParseDecimal

.NET 8.0

24.60 us

1.00

5528 B

1.00

ParseDecimal

.NET 9.0

18.95 us

0.77

856 B

0.15

Once you have a `BigInteger`, there are of course various operations you can do with it. `BigInteger.Equals` was improved by [dotnet/runtime#91416](https://github.com/dotnet/runtime/pull/91416) from [@Rob-Hague](https://github.com/Rob-Hague), which changed the implementation to use the optimized `MemoryExtensions.SequenceEqual` rather than walking the arrays backing each `BigInteger` element-by-element. [dotnet/runtime#104513](https://github.com/dotnet/runtime/pull/104513) from [@Rob-Hague](https://github.com/Rob-Hague) improved `BigInteger.IsPowerOfTwo` by similarly replacing a manual walk of the elements with a call to `ContainsAnyExcept`, looking to see whether all elements after a certain point were 0.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Numerics;
    
    BenchmarkSwitcher.FromAssembly(typeof(Program).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private BigInteger _value1, _value2;
    
        [GlobalSetup]
        public void Setup()
        {
            var value1 = new byte[10_000];
            new Random(42).NextBytes(value1);
    
            _value1 = new BigInteger(value1);
            _value2 = new BigInteger(value1.AsSpan().ToArray());
        }
    
        [Benchmark]
        public bool Equals() => _value1 == _value2;
    }

Method

Runtime

Mean

Ratio

Equals

.NET 8.0

1,110.38 ns

1.00

Equals

.NET 9.0

79.80 ns

0.07

[dotnet/runtime#92208](https://github.com/dotnet/runtime/pull/92208) from [@kzrnm](https://github.com/kzrnm) also improved `BigInteger.Multiply`, and in particular when multiplying a first value that’s much larger than a second value.

    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Numerics;
    
    BenchmarkSwitcher.FromAssembly(typeof(Program).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private BigInteger _value1 = BigInteger.Parse(string.Concat(Enumerable.Repeat("1234567890", 1000)));
        private BigInteger _value2 = BigInteger.Parse(string.Concat(Enumerable.Repeat("1234567890", 300)));
    
        [Benchmark]
        public BigInteger MultiplyLargeSmall() => _value1 * _value2;
    }

Method

Runtime

Mean

Ratio

MultiplyLargeSmall

.NET 8.0

231.0 us

1.00

MultiplyLargeSmall

.NET 9.0

118.8 us

0.51

Lastly, in addition to parsing, `BigInteger` formatting also saw some improvements. [dotnet/runtime#100181](https://github.com/dotnet/runtime/pull/100181) removed various temporary buffer allocations that were occurring as part of formatting and optimized various calculations in order to reduce overheads while formatting these values.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Numerics;
    
    BenchmarkSwitcher.FromAssembly(typeof(Program).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private BigInteger _value = BigInteger.Parse(string.Concat(Enumerable.Repeat("1234567890", 300)));
        private char[] _dest = new char[10_000];
    
        [Benchmark]
        public bool TryFormat() => _value.TryFormat(_dest, out _);
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

TryFormat

.NET 8.0

102.49 us

1.00

7456 B

1.00

TryFormat

.NET 9.0

94.52 us

0.92

–

0.00

### TensorPrimitives

Numerics has been a big focus for .NET over the last several releases. A large stable of numerical operations is now exposed on every numerical type as well as on a set of generic interfaces those types implement. But sometimes you want to perform the same operation on a set of values rather than on an individual value, and for that, we have `TensorPrimitives`. .NET 8 introduced the `TensorPrimitive` type, which provides a plethora of numerical APIs, but for spans of them rather than for individual values. For example, `float` has a `Cosh` method:

    public static float Cosh(float x);

which provides the [hyberbolic cosine](https://mathworld.wolfram.com/HyperbolicCosine.html) of one `float`, and a corresponding method shows up on the `IHyperbolicFunctions<TSelf>` interface:

    static abstract TSelf Cosh(TSelf x);

`TensorPrimitives` then has a corresponding method, but rather than accepting one `float`, it accepts a span of them, and rather than returning the results, it writes the results into a provided destination span:

    public static void Cosh(ReadOnlySpan<float> x, Span<float> destination);

In .NET 8, `TensorPrimitives` provided approximately 40 such methods, and only did so for `float`. Now in .NET 9, this has been significantly expanded. There are now over 200 overloads on `TensorPrimitives`, covering most of the numerical operations that are also exposed on the generic math interfaces (and some that aren’t), _and_ they’re exposed using generics, such that they can work with many more data types than just `float`. For example, while it maintains its `float`\-specific overload of `Cosh` for backwards binary compatibility, `TensorPrimitives` now also sports this overload:

    public static void Cosh<T>(ReadOnlySpan<T> x, Span<T> destination)
        where T : IHyperbolicFunctions<T>

such that it can be used with `Half`, `float`, `double`, `NFloat`, or any custom floating-point type you might have, as long as it implements the relevant interface. Most of these operations are also vectorized, such that it’s more than just a simple loop around the corresponding scalar function.

    // Add a <PackageReference Include="System.Numerics.Tensors" Version="9.0.0" /> to the csproj.
    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Numerics.Tensors;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private float[] _source, _destination;
    
        [GlobalSetup]
        public void Setup()
        {
            var r = new Random(42);
            _source = Enumerable.Range(0, 1024).Select(_ => (float)r.NextSingle()).ToArray();
            _destination = new float[1024];
        }
    
        [Benchmark(Baseline = true)]
        public void ManualLoop()
        {
            ReadOnlySpan<float> source = _source;
            Span<float> destination = _destination;
            for (int i = 0; i < source.Length; i++)
            {
                destination[i] = float.Cosh(source[i]);
            }
        }
    
        [Benchmark]
        public void BuiltIn()
        {
            TensorPrimitives.Cosh<float>(_source, _destination);
        }
    }

Method

Mean

Ratio

ManualLoop

7,804.4 ns

1.00

BuiltIn

621.6 ns

0.08

A huge number of APIs is available, most of which see similar or better gains over the simple loop. Here’s what’s currently available in .NET 9, all as generic methods, and with multiple overloads available for most:

> Abs, Acosh, AcosPi, Acos, AddMultiply, Add, Asinh, AsinPi, Asin, Atan2Pi, Atan2, Atanh, AtanPi, Atan, BitwiseAnd, BitwiseOr, Cbrt, Ceiling, ConvertChecked, ConvertSaturating, ConvertTruncating, ConvertToHalf, ConvertToSingle, CopySign, CosPi, Cos, Cosh, CosineSimilarity, DegreesToRadians, Distance, Divide, Dot, Exp, Exp10M1, Exp10, Exp2M1, Exp2, ExpM1, Floor, FusedMultiplyAdd, HammingDistance, HammingBitDistance, Hypot, Ieee754Remainder, ILogB, IndexOfMaxMagnitude, IndexOfMax, IndexOfMinMagnitude, IndexOfMin, LeadingZeroCount, Lerp, Log2, Log2P1, LogP1, Log, Log10P1, Log10, MaxMagnitude, MaxMagnitudeNumber, Max, MaxNumber, MinMagnitude, MinMagnitudeNumber, Min, MinNumber, MultiplyAdd, MultiplyAddEstimate, Multiply, Negate, Norm, OnesComplement, PopCount, Pow, ProductOfDifferences, ProductOfSums, Product, RadiansToDegrees, ReciprocalEstimate, ReciprocalSqrtEstimate, ReciprocalSqrt, Reciprocal, RootN, RotateLeft, RotateRight, Round, ScaleB, ShiftLeft, ShiftRightArithmetic, ShiftRightLogical, Sigmoid, SinCosPi, SinCos, Sinh, SinPi, Sin, SoftMax, Sqrt, Subtract, SumOfMagnitudes, SumOfSquares, Sum, Tanh, TanPi, Tan, TrailingZeroCount, Truncate, Xor

The possible speedups are even more pronounced on other operations and data types; for example, here is a manual implementation of hamming distance on two input `byte` arrays (hamming distance is the number of elements that differ between the two inputs), and an implementation using `TensorPrimitives.HammingDistance<byte>`:

    // Add a <PackageReference Include="System.Numerics.Tensors" Version="9.0.0" /> to the csproj.
    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Numerics.Tensors;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private byte[] _x, _y;
    
        [GlobalSetup]
        public void Setup()
        {
            var r = new Random(42);
            _x = Enumerable.Range(0, 1024).Select(_ => (byte)r.Next(0, 256)).ToArray();
            _y = Enumerable.Range(0, 1024).Select(_ => (byte)r.Next(0, 256)).ToArray();
        }
    
        [Benchmark(Baseline = true)]
        public int ManualLoop()
        {
            ReadOnlySpan<byte> source = _x;
            Span<byte> destination = _y;
            int count = 0;
            for (int i = 0; i < source.Length; i++)
            {
                if (source[i] != destination[i])
                {
                    count++;
                }
            }
            return count;
        }
    
        [Benchmark]
        public int BuiltIn() => TensorPrimitives.HammingDistance<byte>(_x, _y);
    }

Method

Mean

Ratio

ManualLoop

484.61 ns

1.00

BuiltIn

15.76 ns

0.03

A slew of PRs went into making this happen. The generic method surface area was added via [dotnet/runtime#94555](https://github.com/dotnet/runtime/pull/94555), [dotnet/runtime#97192](https://github.com/dotnet/runtime/pull/97192), [dotnet/runtime#97572](https://github.com/dotnet/runtime/pull/97572), [dotnet/runtime#101435](https://github.com/dotnet/runtime/pull/101435), [dotnet/runtime#103305](https://github.com/dotnet/runtime/pull/103305), and [dotnet/runtime#104651](https://github.com/dotnet/runtime/pull/104651). And then many more PRs added or improved vectorization, including [dotnet/runtime#97361](https://github.com/dotnet/runtime/pull/97361), [dotnet/runtime#97623](https://github.com/dotnet/runtime/pull/97623), [dotnet/runtime#97682](https://github.com/dotnet/runtime/pull/97682), [dotnet/runtime#98281](https://github.com/dotnet/runtime/pull/98281), [dotnet/runtime#97835](https://github.com/dotnet/runtime/pull/97835), [dotnet/runtime#97846](https://github.com/dotnet/runtime/pull/97846), [dotnet/runtime#97874](https://github.com/dotnet/runtime/pull/97874), [dotnet/runtime#97999](https://github.com/dotnet/runtime/pull/97999), [dotnet/runtime#98877](https://github.com/dotnet/runtime/pull/98877), [dotnet/runtime#103214](https://github.com/dotnet/runtime/pull/103214) from [@neon-sunset](https://github.com/neon-sunset), and [dotnet/runtime#103820](https://github.com/dotnet/runtime/pull/103820).

As part of all of this work, there was also a recognition that we had the scalar operations and we had the operations on an unbounded number of elements as part of spans, but doing the latter efficiently required effectively having the same set of operations on the various `Vector128<T>`, `Vector256<T>`, and `Vector512<T>` types, since the typical structure of one of these operations will process vectors of elements at time. As such, progress has been made towards also exposing the same set of operations on these vector types. That’s been done in [dotnet/runtime#104848](https://github.com/dotnet/runtime/pull/104848), [dotnet/runtime#102181](https://github.com/dotnet/runtime/pull/102181), [dotnet/runtime#103837](https://github.com/dotnet/runtime/pull/103837), [dotnet/runtime#97114](https://github.com/dotnet/runtime/pull/97114), and [dotnet/runtime#96455](https://github.com/dotnet/runtime/pull/96455). More to come.

Other related numerical types have also seen improvements. Quaternion multiplication was vectorized in [dotnet/runtime#96624](https://github.com/dotnet/runtime/pull/96624) by [@TJHeuvel](https://github.com/TJHeuvel), and [dotnet/runtime#103527](https://github.com/dotnet/runtime/pull/103527) accelerated a variety of operations on `Quaternion`, `Plane`, `Vector2`, `Vector3`, `Vector4`, `Matrix4x4`, and `Matrix3x2`.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Numerics;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private Quaternion _value1 = Quaternion.CreateFromYawPitchRoll(0.5f, 0.3f, 0.2f);
        private Quaternion _value2 = Quaternion.CreateFromYawPitchRoll(0.1f, 0.2f, 0.3f);
    
        [Benchmark]
        public Quaternion Multiply() => _value1 * _value2;
    }

Method

Runtime

Mean

Ratio

Multiply

.NET 8.0

3.064 ns

1.00

Multiply

.NET 9.0

1.086 ns

0.35

[dotnet/runtime#102301](https://github.com/dotnet/runtime/pull/102301) also moves a lot of the implementation for types like `Quaternion` out of the JIT / native code into C#, something that’s only possible now because of many of the other improvements discussed elsewhere in this post.

Strings, Arrays, Spans
----------------------

### IndexOf

As previously noted in [Performance Improvements in .NET 8](https://devblogs.microsoft.com/dotnet/performance-improvements-in-net-8/) and earlier in this post, my single favorite performance improvement in .NET 8 came from enabling dynamic PGO. But my second favorite improvement came from the introduction of `SearchValues<T>`. `SearchValues<T>` enables optimizing searches, by pre-computing an algorithm to use when searching for a specific set of values (or for anything other than those specific values) and storing that information for later repeated use. Internally, .NET 8 included upwards of 15 different implementations that might be chosen based on the nature of the supplied data. The type was so good at what it did that it was used in over 60 places as part of the .NET 8 release. In .NET 9, it’s used even more, and it gets even better, in a multitude of ways.

The `SearchValues<T>` type is generic, so in theory it can be used for any `T`, but in practice, the algorithms involved need to special-case the nature of the data, and so the `SearchValues.Create` factory methods only enabled creating `SearchValues<byte>` and `SearchValues<char>` instances for which dedicated implementations were provided. For example, many of the previously noted uses of `SearchValues<T>` are searching for a subset of ASCII, such as this use from `Regex.Escape`, which enables quickly searching for all characters that require escaping:

    private static readonly SearchValues<char> s_metachars = SearchValues.Create("\t\n\f\r #$()*+.?[\\^{|");

If you print out the name of the type of the instance returned by that `Create` call, as an implementation detail today you’ll see something like this:

    System.Buffers.AsciiCharSearchValues`1[System.Buffers.IndexOfAnyAsciiSearcher+Default]

That type provides a specialization of `SearchValues<char>` optimized for searching for any ASCII subset, doing so with an implementation based on the “Universal algorithm” described at [http://0x80.pl/articles/simd-byte-lookup.html](http://0x80.pl/articles/simd-byte-lookup.html#universal-algorithm). Essentially, the algorithm maintains an 8 by 16 bitmap, which not coincidentally is the size of ASCII (0 through 127). Each of the 128 bits in the bitmap represents whether the corresponding ASCII value is in the set. The input chars are mapped down to bytes in a way where chars greater than 127 are mapped to a value meaning no match. The lower nibble (4 bits) of the ASCII value is used to select one of the 16 bitmap rows, and the upper nibble is used to select one of the 8 bitmap columns. And the beauty of this algorithm is, on most supported platforms, there exist SIMD instructions that enable the processing of many characters concurrently as part of just a few instructions.

So, in .NET 8, `SearchValues<T>` was only for `byte` and `char`. But, now in .NET 9, thanks to [dotnet/runtime#88394](https://github.com/dotnet/runtime/pull/88394), [dotnet/runtime#96429](https://github.com/dotnet/runtime/pull/96429), [dotnet/runtime#96928](https://github.com/dotnet/runtime/pull/96928), [dotnet/runtime#98901](https://github.com/dotnet/runtime/pull/98901), and [dotnet/runtime#98902](https://github.com/dotnet/runtime/pull/98902), you can also create `SearchValues<string>` instances. The string handling is different from `byte` and `char`, however. With `byte`, you’re searching for one of a set of `byte`s within a span of `byte`s. With `char`, you’re searching for one of a set of `char`s within a span of `char`s. But with `string`, `SearchValues<string>` doesn’t search for one of a set of `string`s within a span of `string`s, but rather it enables searching for one of a set of `string`s within a span of `char`s. In other words, it’s a multi-string search. For example, let’s say you want to search some text for the ISO 8601 days of the week, and to do so in an ordinal case-insensitive manner (such that, for example, both “Monday” and “MONDAY” would match). That can now be expressed like this:

    private static readonly SearchValues<string> s_daysOfWeek = SearchValues.Create(
        ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        StringComparison.OrdinalIgnoreCase);
    ...
    ReadOnlySpan<char> textToSearch = ...;
    int i = textToSearch.IndexOfAny(s_daysOfWeek);

This also highlights another interesting difference from the existing `byte` and `char` support. For those types, `SearchValues` is purely an optimization: `IndexOfAny` overloads have long existed for searching for sets of `T` values within a larger collection of `T`s (e.g. `string.IndexOfAny(char[] anyOf)` was introduced over two decades ago), and the `SearchValues` support simply makes those use cases faster (often _much_ faster). In contrast, until .NET 9 there have not been any built-in methods for doing multi-string search, so this new support both adds such support and adds it in a way that is highly-efficient.

But, let’s say we did want to perform such a search, without that functionality existing in the core libraries. One approach is to simply walk through the input, position by position, comparing each of the target values at that location:

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private static readonly string s_input = new HttpClient().GetStringAsync("https://gutenberg.org/cache/epub/2600/pg2600.txt").Result;
        private static readonly string[] s_daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    
        [Benchmark(Baseline = true)]
        public bool Contains_Iterate()
        {
            ReadOnlySpan<char> input = s_input;
    
            for (int i = 0; i < input.Length; i++)
            {
                foreach (string dow in s_daysOfWeek)
                {
                    if (input.Slice(i).StartsWith(dow, StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }
                }
            }
    
            return false;
        }
    }

Method

Mean

Ratio

Contains\_Iterate

227.526 us

1.000

Classic. Functional. And slow. This is doing a fair amount of work for every single character in the input, for each looping over every day name and doing a comparison. How can we do better? First, we could try making the inner loop more efficient. Rather than iterating through the strings, we could hardcode our own switch:

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private static readonly string s_input = new HttpClient().GetStringAsync("https://gutenberg.org/cache/epub/2600/pg2600.txt").Result;
    
        [Benchmark]
        public bool Contains_Iterate_Switch()
        {
            ReadOnlySpan<char> input = s_input;
    
            for (int i = 0; i < input.Length; i++)
            {
                ReadOnlySpan<char> slice = input.Slice(i);
                switch ((char)(input[i] | 0x20))
                {
                    case 's' when slice.StartsWith("Sunday", StringComparison.OrdinalIgnoreCase) || slice.StartsWith("Saturday", StringComparison.OrdinalIgnoreCase):
                    case 'm' when slice.StartsWith("Monday", StringComparison.OrdinalIgnoreCase):
                    case 't' when slice.StartsWith("Tuesday", StringComparison.OrdinalIgnoreCase) || slice.StartsWith("Thursday", StringComparison.OrdinalIgnoreCase):
                    case 'w' when slice.StartsWith("Wednesday", StringComparison.OrdinalIgnoreCase):
                    case 'f' when slice.StartsWith("Friday", StringComparison.OrdinalIgnoreCase):
                        return true;
                }
            }
    
            return false;
        }
    }

The main benefit of this is it makes the `StartsWith` calls much more efficient. Because each call is dedicated to a specific needle that the JIT can see, it can emit customized code to optimize that comparison (for context on my choice of language, “needle” is often used when describing a thing being searched for, a reference to the proverbial “needle in a haystack,” and thus “haystack” is used to describe the thing being searched). We’re also reducing the number of cases in the switch by employing an ASCII casing trick; the upper case ASCII letters differ in numerical value from the lower case ASCII letters by a single bit, so we simply ensure that bit is set and then compare against only the lower case letters.

Method

Mean

Ratio

Contains\_Iterate

227.526 us

1.000

Contains\_Iterate\_Switch

13.885 us

0.061

Much better, more than a 16x improvement. What if we instead just kept things simple and searched for each individual string using the already-optimized `IndexOf`?

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private static readonly string s_input = new HttpClient().GetStringAsync("https://gutenberg.org/cache/epub/2600/pg2600.txt").Result;
        private static readonly string[] s_daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    
        [Benchmark]
        public bool Contains_ContainsEachNeedle()
        {
            ReadOnlySpan<char> input = s_input;
    
            foreach (string dow in s_daysOfWeek)
            {
                if (input.Contains(dow, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
    
            return false;
        }
    }

Nice and simple, but…

Method

Mean

Ratio

Contains\_Iterate

227.526 us

1.000

Contains\_Iterate\_Switch

13.885 us

0.061

Contains\_ContainsEachNeedle

302.330 us

1.329

Ouch. On the positive side, this approach benefits from vectorization, as the `Contains` operation itself is vectorized to efficiently check multiple locations at once using SIMD. Unfortunately, this case is heavily impacted by the order in which we perform the search. As it turns out, most of the days of the week show up in the input text (in this case, “War and Peace”), but at very different positions, and Monday doesn’t show up at all. This:

    using var hc = new HttpClient();
    var s = await hc.GetStringAsync("https://gutenberg.org/cache/epub/2600/pg2600.txt");
    Console.WriteLine($"Length:    {s.Length}");
    Console.WriteLine($"Monday:    {s.IndexOf("Monday", StringComparison.OrdinalIgnoreCase)}");
    Console.WriteLine($"Tuesday:   {s.IndexOf("Tuesday", StringComparison.OrdinalIgnoreCase)}");
    Console.WriteLine($"Wednesday: {s.IndexOf("Wednesday", StringComparison.OrdinalIgnoreCase)}");
    Console.WriteLine($"Thursday:  {s.IndexOf("Thursday", StringComparison.OrdinalIgnoreCase)}");
    Console.WriteLine($"Friday:    {s.IndexOf("Friday", StringComparison.OrdinalIgnoreCase)}");
    Console.WriteLine($"Saturday:  {s.IndexOf("Saturday", StringComparison.OrdinalIgnoreCase)}");
    Console.WriteLine($"Sunday:    {s.IndexOf("Sunday", StringComparison.OrdinalIgnoreCase)}");

yields this:

    Length:    3293614
    Monday:    -1
    Tuesday:   971396
    Wednesday: 10652
    Thursday:  107470
    Friday:    640801
    Saturday:  1529549
    Sunday:    891753

That means that whereas `Contains_Iterate_Switch` only needs to examine 10,652 positions (the position of the first “Wednesday”) before it finds a match, `Contains_ContainsEachNeedle` needs to examine 3,293,614 (no match found for “Monday” so it’ll look at everything) + 971,396 (the index of “Tuesday”) == 4,265,010 positions before it finds a match. That’s 400x as many positions to be examined as the iterative approach. Even the SIMD vectorization gains can’t match that gap in amount of work to be performed.

Ok, so what if we changed approach, and instead searched for the first letter in each word in order to quickly skip past the locations that couldn’t possibly match. We could even use `SearchValues<char>` to perform that search.

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Buffers;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private static readonly string s_input = new HttpClient().GetStringAsync("https://gutenberg.org/cache/epub/2600/pg2600.txt").Result;
        private static readonly SearchValues<char> s_daysOfWeekFCSV = SearchValues.Create(['S', 's', 'M', 'm', 'T', 't', 'W', 'w', 'F', 'f']);
    
        [Benchmark]
        public bool Contains_IndexOfAnyFirstChars_SearchValues()
        {
            ReadOnlySpan<char> input = s_input;
    
            int i;
            while ((i = input.IndexOfAny(s_daysOfWeekFCSV)) >= 0)
            {
                ReadOnlySpan<char> slice = input.Slice(i);
                switch ((char)(input[i] | 0x20))
                {
                    case 's' when slice.StartsWith("Sunday", StringComparison.OrdinalIgnoreCase) || slice.StartsWith("Saturday", StringComparison.OrdinalIgnoreCase):
                    case 'm' when slice.StartsWith("Monday", StringComparison.OrdinalIgnoreCase):
                    case 't' when slice.StartsWith("Tuesday", StringComparison.OrdinalIgnoreCase) || slice.StartsWith("Thursday", StringComparison.OrdinalIgnoreCase):
                    case 'w' when slice.StartsWith("Wednesday", StringComparison.OrdinalIgnoreCase):
                    case 'f' when slice.StartsWith("Friday", StringComparison.OrdinalIgnoreCase):
                        return true;
                }
    
                input = input.Slice(i + 1);
            }
    
            return false;
        }
    }

In some situations, this is a very viable strategy; in fact, it’s a technique often employed by `Regex`. In other situations, it’s less appropriate. The potential problem is that letters like ‘s’ and ‘t’ are incredibly common. The characters here (‘s’, ‘m’, ‘t’, ‘w’, and ‘f’), both upper- and lower-case variants, make up ~17% of the input text (in contrast to just the capital subset, which makes up only ~0.54%). That means that, on average, this `IndexOfAny` call needs to break out of its inner vectorized processing loop every six characters, which decreases the possible efficiency gains from said vectorization. Even so, this is still our best so far:

Method

Mean

Ratio

Contains\_Iterate

227.526 us

1.000

Contains\_Iterate\_Switch

13.885 us

0.061

Contains\_ContainsEachNeedle

302.330 us

1.329

Contains\_IndexOfAnyFirstChars\_SearchValues

7.151 us

0.031

Now, let’s try with `SearchValues<string>`:

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Buffers;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private static readonly string s_input = new HttpClient().GetStringAsync("https://gutenberg.org/cache/epub/2600/pg2600.txt").Result;
        private static readonly SearchValues<string> s_daysOfWeekSV = SearchValues.Create(
            ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], 
            StringComparison.OrdinalIgnoreCase);
    
        [Benchmark]
        public bool Contains_StringSearchValues() =>
            s_input.AsSpan().ContainsAny(s_daysOfWeekSV);
    }

The functionality is built-in, so we haven’t had to write any custom logic other than the call to `ContainsAny`. And the results:

Method

Mean

Ratio

Contains\_Iterate

227.526 us

1.000

Contains\_Iterate\_Switch

13.885 us

0.061

Contains\_ContainsEachNeedle

302.330 us

1.329

Contains\_IndexOfAnyFirstChars\_SearchValues

7.151 us

0.031

Contains\_StringSearchValues

2.153 us

0.009

Not only simpler, then, but also several times faster than the fastest result we’d previously managed, and ~105x faster than our original attempt. Sweet!

How does this all work? The algorithms behind it are quite fascinating. As with `byte` and `char`, there are multiple concrete implementations that might be employed, selected based on the exact needle values passed to `Create`. The simplest implementations are those for handling degenerate cases, like zero inputs (in which case all of the methods can just return hard-coded “not found” results). There’s also a dedicated implementation for a single input, in which case it can perform the same search as `IndexOf(needle)` would have done, but lifting out the choice of characters within the needle for which to perform a vectorized search. `IndexOf(string)` chooses a couple of characters from the needle (typically just the first and last character in the needle), creates a vector for each of those, and then with appropriate offsets based on the distance between the chosen characters, iterates through the input, comparing against those vectors, and doing a full string comparison only if both vectors match at a particular location. `SearchValues<string>` does the same thing (in an internal implementation today called `SingleStringSearchValuesThreeChars`), except it uses three instead of two characters, and it employs frequency analysis to choose those characters rather than simply picking the first and last, trying to use characters that are less likely to appear in general (e.g. given the string “amazing”, it’d likely pick the ‘m’, ‘z’, and ‘g’, as it deems those statistically less likely in average inputs than ‘a’, ‘i’, or ‘n’). It can take more time to do this given it can perform the computation once and then cache it for all subsequent searches. We’ll refer back to this in a bit.

Beyond those special cases, it starts to get really interesting. There’s been a lot of research done over the last 50 years for the most efficient ways to perform a multi-string search. One popular algorithm is Rabin-Karp, which was created by Richard Karp and Michael Rabin in the 1980s, and which works via a “rolling hash.” Imagine creating a hash of the first N characters in the haystack (input) text, where N is the length of the needle (the substring) for which you’re searching, and comparing the haystack hash against the needle hash; if they match, do the actual full comparison at that location, otherwise continue. Then update the hash by removing the first character and adding the next character, and repeat the check. And then repeat, and repeat, and so on. Each time you move forward, you’re just updating the hash via a fixed number of operations, meaning that all of the updates to the hash function for the whole operation are only `O(Haystack)`. Best case, you only find a single location that the substring could match, and you’ve got `O(Haystack + Needle)` algorithmic complexity. Worst case (but generally unlikely), every location is a possible match, and you’ve got `O(Haystack * Needle)` algorithmic complexity. A simple implementation might look like this (for pedagogical purposes, this uses a terrible hash function that just sums the character’s numerical values; the real algorithm recommends a better one):

    private static bool RabinKarpContains(ReadOnlySpan<char> haystack, ReadOnlySpan<char> needle)
    {
        if (haystack.Length >= needle.Length)
        {
            // Hash the needle and the first needle.Length chars of the haystack.
            // Super simple hash for pedagogical purposes: just sum the chars.
            int i, rollingHash = 0, needleHash = 0;
            for (i = 0; i < needle.Length; i++)
            {
                rollingHash += haystack[i];
                needleHash += needle[i];
            }
    
            while (true)
            {
                // If the hashes match, compare the strings.
                if (needleHash == rollingHash && haystack.Slice(i - needle.Length).StartsWith(needle))
                {
                    return true;
                }
    
                // If we've reached the end of the haystack, break.
                if (i == haystack.Length)
                {
                    break;
                }
    
                // Update the rolling hash.
                rollingHash += haystack[i] - haystack[i - needle.Length];
                i++;
            }
        }
    
        return needle.IsEmpty;
    }

This supports one needle, but extending to support multiple needles can be accomplished in a variety of ways, such as by bucketing needles by their hash codes (ala what a hash map does), and then either checking all needles in the corresponding bucket when there’s a hit, or further reduction in what needs to be checked based on using a Bloom filter or similar technique. `SearchValues<string>` will utilize Rabin-Karp, but only for very short inputs, as for longer inputs there are more efficient approaches.

Another popular algorithm is Aho-Corasick, which was designed by Alfred Aho and Margaret Corasick even earlier, in the 1970s. Its primary purpose is multi-string search, enabling finding a match to be performed in linear time in the length of the input, assuming a fixed set of needles. It works by building up a form of a trie, a finite automaton where you start at the root of the graph and transition to children based on matching the character associated with the edge to that child. But, it extends a typical trie with additional edges between nodes that can be used as fallbacks. For example, here’s the automaton for the days of the week discussed earlier: ![Aho-Corasick automaton for the days of the week](https://devblogs.microsoft.com/dotnet/wp-content/uploads/sites/10/2024/09/AhoCorasick_DaysOfWeek.png) Given the input text “wednesunday”, this will start at the root, progress through the “w”, “we”, “wed”, “wedn”, “wedne”, and “wednes” nodes, but then upon encountering the subsequent ‘u’ and not being able to progress down that path, it’ll employ the fallback link over to the “s” node, at which point it’ll be able to traverse down through “s”, “su”, and so on, until it hits the leaf “sunday” node and can declare success. Aho-Corasick efficiently supports larger strings, and is the go-to implementation `SearchValues<string>` uses as a general fallback. However, in many situations, it can do even better…

The real workhorse of `SearchValues<string>` that’s chosen whenever possible is a vectorized implementation of the “Teddy” algorithm. This algorithm originated in Intel’s [Hyperscan](https://github.com/intel/hyperscan) library, was later adopted by the Rust aho\_corasick crate, and is now employed as part of `SearchValues<string>` in .NET 9. It is super cool, and super efficient.

Earlier, I gave a rough summary of how the `SingleStringSearchValuesThreeChars` and `IndexOfAnyAsciiSearcher` implementations work. `SingleStringSearchValuesThreeChars` optimizes finding likely positions where a substring might start, reducing the number of false positives by checking for multiple contained characters, and then likely positions are validated by doing the full string comparison at that location. And `IndexOfAnyAsciiSearcher` optimizes finding the next position of any character in a large-ish set. You can think of Teddy as a combination of those. There’s a really nice description of the algorithm [in the source](https://github.com/dotnet/runtime/blob/122d97b4674681745a0c335ace2c5231b1da7a96/src/libraries/System.Private.CoreLib/src/System/SearchValues/Strings/AsciiStringSearchValuesTeddyBase.cs#L17-L94), so I won’t go into much detail here. In summary, though, it maintains a similar bitmap as with `IndexOfAnyAsciiSearcher`, but instead of a single bit per ASCII character, it maintains an 8-bit bitmap for each nibble, and instead of just one bitmap, it maintains two or three, each of which corresponds to a location in the substrings (e.g. one bitmap for the 0th character and one bitmap for the 1st character). Those 8 bits in the bitmap are used to indicate which of up to 8 needles contain that nibble at that location. If there are fewer than 8 needles being searched for, then each of these bits individually identifies one of them, and if there are more than 8 needles, just as with Rabin-Karp, we can create buckets of the needle substrings, with a bit in the bitmap referring to one of the buckets. If the comparisons against the bitmaps indicates a likely match, the full match is performed against the relevant needle (or needles, in the case of matching a bucket). And as with `IndexOfAnyAsciiSearcher`, all of this support employs SIMD instructions to perform the lookups on chunks of input text from between 16 and 64 characters at a time, yielding significant speedups.

`SearchValues<string>` is great for larger numbers of strings, but it’s relevant even for just a few. Consider, for example, this code from MSBuild that’s part of parsing build output looking for warnings and errors:

    if (message.IndexOf("warning", StringComparison.OrdinalIgnoreCase) == -1 &&
        message.IndexOf("error", StringComparison.OrdinalIgnoreCase) == -1)
    {
        return null;
    }

Rather than doing two individual searches, we can perform a single search:

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Buffers;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private static readonly string s_input = new HttpClient().GetStringAsync("https://gutenberg.org/cache/epub/2600/pg2600.txt").Result;
        private static readonly SearchValues<string> s_warningError = SearchValues.Create(["warning", "error"], StringComparison.OrdinalIgnoreCase);
    
        [Benchmark(Baseline = true)]
        public bool TwoContains() =>
            s_input.Contains("warning", StringComparison.OrdinalIgnoreCase) ||
            s_input.Contains("error", StringComparison.OrdinalIgnoreCase);
    
        [Benchmark]
        public bool ContainsAny() =>
            s_input.AsSpan().ContainsAny(s_warningError);
    }

This is searching “War and Peace” for both “warning” or “error”, but even though both appear in the text, such that the second search for “error” in the original code will never happen, the `SearchValues<string>` search ends up being faster because “error” appears much earlier in the text than does “warning”.

Method

Mean

Ratio

TwoContains

70.03 us

1.00

ContainsAny

14.05 us

0.20

Beyond `SearchValues<string>`, the existing `SearchValues<byte>` and `SearchValues<char>` support also gets a variety of boosts in .NET 9. [dotnet/runtime#96588](https://github.com/dotnet/runtime/pull/96588), for example, makes some common `SearchValues<char>` searches faster, specifically when there are 2 or 4 characters being searched for that represent 1 or 2 ASCII case-insensitive characters, such as `['A', 'a']` or `['A', 'a', 'B', 'b']`. In .NET 8, for `['A', 'a']`, for example, `SearchValues.Create` will end up picking an implementation that will create a vector for each of `'A'` and `'a'`, and then in the inner loop of the search, it’ll compare each vector against the input haystack text. This PR teaches it to do a similar ASCII trick we discussed earlier: rather than having two separate vectors, it can have a single vector for `'a'`, and then do a single comparison against the input vector that’s been OR’d with `0x20`, such that any `'A'`s become `'a'`s. The OR plus a single comparison is cheaper than the two comparisons plus the OR of the resulting comparisons. Funnily enough, this needn’t even be about casing: since all we’re doing is OR’ing in `0x20`, it applies to any two characters that differ by that same single bit.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Buffers;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private static readonly string s_input = new HttpClient().GetStringAsync("https://www.gutenberg.org/cache/epub/100/pg100.txt").Result;
        private static readonly SearchValues<char> s_symbols = SearchValues.Create("@`");
    
        [Benchmark]
        public bool ContainsAny() => s_input.AsSpan().ContainsAny(s_symbols);
    }

Method

Runtime

Mean

Ratio

ContainsAny

.NET 8.0

262.7 us

1.02

ContainsAny

.NET 9.0

232.3 us

0.90

The same thing applies with four characters: instead of doing four vector comparisons and three OR operations to combine them, we can do a single OR on the input to mix in `0x20`, two vector comparisons, and a single OR to combine those results. In fact, the four-vector approach was already more expensive than the `IndexOfAnyAsciiSearcher` implementation previously described, and since that supports any number of ASCII characters, when applicable even for just four-character needles, `SearchValues.Create` would have preferred that. But now in .NET 9 with this optimization, `SearchValues.Create` will prefer to use this specialized two-comparison path.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Buffers;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private static readonly string s_input = new HttpClient().GetStringAsync("https://www.gutenberg.org/cache/epub/100/pg100.txt").Result;
        private static readonly SearchValues<char> s_symbols = SearchValues.Create("@`^~");
    
        [Benchmark]
        public bool ContainsAny() => s_input.AsSpan().ContainsAny(s_symbols);
    }

Method

Runtime

Mean

Ratio

ContainsAny

.NET 8.0

247.5 us

1.01

ContainsAny

.NET 9.0

196.2 us

0.80

Other `SearchValues` implementations also improve in .NET 9, notably the “ProbabilisticMap” implementations. These implementations are preferred by `SearchValues<char>` as a fallback when the faster vectorized implementations aren’t applicable but when the number of characters in the needle isn’t exorbitant (the current limit is 256). It works via a form of Bloom filter. Effectively, it maintains a 256-bit bitmap, with needle characters mapping to one or two bits, depending on the `char`. If any of the bits for a given `char` isn’t `1`, then the `char` is definitively not in the set. If all of the bits for a given `char` are `1`, then the `char` _may_ be in the set, and a more expensive check needs to be performed to determine inclusion. Whether those bits are set is a vectorizable operation, and so as long as false positives are relatively rare (which is why there’s a limit on the number of characters; the more characters are represented, the more false positives there’s likely to be), it’s an efficient means for doing the search. However, this vectorization only applies to positive cases (e.g. `IndexOfAny` / `ContainsAny`) but not negative cases (e.g. `IndexOfAnyExcept` / `ContainsAnyExcept`); for those “Except” methods, the implementation still walks character by character, and the check it employed per character was `O(Needle)`. Thanks to [dotnet/runtime#101001](https://github.com/dotnet/runtime/pull/101001), which replaces a linear search with a “perfect hash,” that `O(Needle)` drops to `O(1)`, making such “Except” calls much more efficient.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Buffers;
    using System.Text.RegularExpressions;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        public static readonly string s_aristotle = new HttpClient().GetStringAsync("https://www.gutenberg.org/cache/epub/39963/pg39963.txt").Result;
        public static readonly SearchValues<char> s_greekOrAsciiDigits = SearchValues.Create(
            Enumerable.Range(0, char.MaxValue + 1)
            .Where(i => Regex.IsMatch(((char)i).ToString(), @"[\p{IsGreek}0-9]"))
            .Select(i => (char)i)
            .ToArray());
    
        [Benchmark]
        public int CountNonGreekOrAsciiDigitsChars()
        {
            int count = 0;
    
            ReadOnlySpan<char> text = s_aristotle;
            int index;
            while ((index = text.IndexOfAnyExcept(s_greekOrAsciiDigits)) >= 0)
            {
                count++;
                text = text.Slice(index + 1);
            }
    
            return count;
        }
    }

Method

Runtime

Mean

Ratio

CountNonGreekOrAsciiDigitsChars

.NET 8.0

1,814.7 us

1.00

CountNonGreekOrAsciiDigitsChars

.NET 9.0

881.7 us

0.49

That same PR also made another significant improvement related to the probabilistic map: not using it as much. It’s a terrific implementation for some sets of inputs, but for others it can end up performing poorly. .NET 8 included a `Latin1CharSearchValues`, which was used when some of the needle characters were non-ASCII but all were less than 256. In such cases, if the probabilistic map couldn’t vectorize, `SearchValues.Create` would return a `Latin1CharSearchValues` instance, which maintained a simple 256-bit bitmap that detailed whether each character is in the needle. For .NET 9, that type has been replaced by a more general one that supports arbitrarily large bitmaps, used when there are simply too many for the probabilistic map implementation to handle well or when the values are sufficiently dense. Consider a case like this:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Buffers;
    using System.Text.RegularExpressions;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        public static readonly string s_markTwain = new HttpClient().GetStringAsync("https://www.gutenberg.org/cache/epub/3200/pg3200.txt").Result;
        public static readonly SearchValues<char> s_greekChars = SearchValues.Create(
            Enumerable.Range(0, char.MaxValue + 1)
            .Where(i => Regex.IsMatch(((char)i).ToString(), @"[\p{IsGreek}\p{IsGreekExtended}]"))
            .Select(i => (char)i)
            .ToArray());
    
        [Benchmark]
        public int CountGreekChars()
        {
            int count = 0;
    
            ReadOnlySpan<char> text = s_markTwain;
            int index;
            while ((index = text.IndexOfAny(s_greekChars)) >= 0)
            {
                count++;
                text = text.Slice(index + 1);
            }
    
            return count;
        }
    }

The needle here includes all of the characters in the Greek and Greek Extended Unicode blocks, approximately 400 characters. With the way the probabilistic map builds up its filter bitmap, every single bit in the bitmap ends up being set, which means every examined character will fall back to the expensive path. Now in .NET 9, it’ll use a simpler, non-probabilistic bitmap, and even though it’s not vectorized, it yields significantly faster throughput.

Method

Runtime

Mean

Ratio

CountGreekChars

.NET 8.0

126.454 ms

1.00

CountGreekChars

.NET 9.0

8.956 ms

0.07

[dotnet/runtime#96931](https://github.com/dotnet/runtime/pull/96931) also extended this probabilistic map support to benefit from AVX512 such that when the probabilistic map implementation is used, it can be significantly faster. Previously, its implementation would utilize 128-bit or 256-bit vectors, depending on hardware support, but now in .NET 9, it can also use 512-bit vectors. This not only possibly doubles throughput due to vector width, AVX512 also includes some applicable instructions that the older instruction sets don’t have (e.g. `VPERMB`, which is exposed as `Avx512Vbmi.PermuteVar64x8`), enabling even faster processing due to employing those more sophisticated instructions where relevant. This ends up being particularly impactful when searching for a reasonably small number of non-ASCII characters.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Buffers;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        public static readonly string s_aristotle = new HttpClient().GetStringAsync("https://www.gutenberg.org/cache/epub/39963/pg39963.txt").Result;
        public static readonly SearchValues<char> s_setSymbols = SearchValues.Create("⊂⊃⊆⊇⊄∩∪∈∊∉∋∍∌∅");
    
        [Benchmark]
        public int Count()
        {
            int count = 0;
    
            ReadOnlySpan<char> text = s_aristotle;
            int index;
            while ((index = text.IndexOfAny(s_setSymbols)) >= 0)
            {
                count++;
                text = text.Slice(index + 1);
            }
    
            return count;
        }
    }

Method

Runtime

Mean

Ratio

Count

.NET 8.0

28.35 us

1.00

Count

.NET 9.0

13.19 us

0.47

Further, while the probabilistic map implementations were previously vectorized for `IndexOfAny` (and therefore implicitly for `ContainsAny`), they weren’t for `LastIndexOfAny`, which means just changing whether you were searching from start to end or from end to start could have a significant impact on throughput. [dotnet/runtime#102331](https://github.com/dotnet/runtime/pull/102331) improves that as well, enabling the `LastIndexOfAny` path to also take advantage of SIMD.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Buffers;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        public static readonly string s_markTwain = new HttpClient().GetStringAsync("https://www.gutenberg.org/cache/epub/3200/pg3200.txt").Result;
        public static readonly SearchValues<char> s_accentedChars = SearchValues.Create(
            ['À', 'È', 'Ì', 'Ò', 'Ù', 'Á', 'É', 'Í', 'Ó', 'Ú', 
             'Â', 'Ê', 'Î', 'Ô', 'Û', 'Ã', 'Ẽ', 'Ĩ', 'Õ', 'Ũ', 
             'Ä', 'Ë', 'Ï', 'Ö', 'Ü', 'Ÿ']);
    
        [Benchmark]
        public bool HasAnyAccented_IndexOfAny() => s_markTwain.AsSpan().IndexOfAny(s_accentedChars) >= 0;
    
        [Benchmark]
        public bool HasAnyAccented_LastIndexOfAny() => s_markTwain.AsSpan().LastIndexOfAny(s_accentedChars) >= 0;
    }

Method

Runtime

Mean

Ratio

HasAnyAccented\_IndexOfAny

.NET 8.0

7.910 ms

1.00

HasAnyAccented\_IndexOfAny

.NET 9.0

4.476 ms

0.57

HasAnyAccented\_LastIndexOfAny

.NET 8.0

17.491 ms

1.00

HasAnyAccented\_LastIndexOfAny

.NET 9.0

5.253 ms

0.30

In many of my examples, I’ve used `ContainsAny` rather than `IndexOfAny`. The former is functionally equivalent to `input.IndexOfAny(searchValues) >= 0`, and in fact that was the entirety of the implementation in .NET 8. However, as `IndexOfAny` employs vectorization and is comparing multiple elements as part of the same instruction, when a match is found, there is a bit of overhead involved to then determine exactly which element matched (or if multiple matched, which match had the lowest index). `ContainsAny` doesn’t actually need to care about the exact index: as exemplified by its implementation, it only cares about whether there was a match rather than where one was. As such, we can shave off some cycles by customizing the implementation for `ContainsAny` to avoid that unnecessary computation, and that’s exactly what [dotnet/runtime#96924](https://github.com/dotnet/runtime/pull/96924) does. The effects of this are most notable where that overhead would be measurable, which is when a match is found really early in the input.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Buffers;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private string _haystack = "Hello, world! How are you today?";
        private static readonly SearchValues<char> s_vowels = SearchValues.Create("aeiou");
    
        [Benchmark]
        public bool ContainsAny() => _haystack.AsSpan().ContainsAny(s_vowels);
    }

Method

Runtime

Mean

Ratio

ContainsAny

.NET 8.0

3.640 ns

1.00

ContainsAny

.NET 9.0

2.382 ns

0.65

Improvements around `SearchValues` aren’t limited just to new APIs or the implementation of the APIs; there’s also been work to help developers better consume `SearchValues`. [dotnet/roslyn-analyzers#6898](https://github.com/dotnet/roslyn-analyzers/pull/6898) and [dotnet/roslyn-analyzers#7252](https://github.com/dotnet/roslyn-analyzers/pull/7252) added a new analyzer ([CA1870](https://learn.microsoft.com/dotnet/fundamentals/code-analysis/quality-rules/ca1870)) that will find opportunities to use `SearchValues` and automatically fix the call sites to do so.

![CA1870 analyzer for SearchValues](https://devblogs.microsoft.com/dotnet/wp-content/uploads/sites/10/2024/09/SearchValuesAnalyzer.png)

It’s also worth highlighting that there have been improvements around `IndexOf` / `Contains` in .NET 9 besides with `SearchValues`. One simple but interesting change is [dotnet/runtime#97632](https://github.com/dotnet/runtime/pull/97632). This simply added an `if` block to `string.Contains(string)`:

    public bool Contains(string value)
    {
        if (value == null)
            ThrowHelper.ThrowArgumentNullException(ExceptionArgument.value);
    
        // PR added this if block
        if (RuntimeHelpers.IsKnownConstant(value) && value.Length == 1)
            return Contains(value[0]);
    
        return SpanHelpers.IndexOf(
            ref _firstChar,
            Length,
            ref value._firstChar,
            value.Length) >= 0;
    }

What’s interesting about this is the `SpanHelpers.IndexOf` it delegates to already contains a fast path that special-cases single-character strings:

    if (valueTailLength == 0)
    {
        // for single-char values use plain IndexOf
        return IndexOfChar(ref searchSpace, value, searchSpaceLength);
    }

Why then is this extra `if` block helpful? It’s taking advantage of that same internal `IsKnownConstant` intrinsic we saw earlier. The JIT will always compile this method down to a `true`/`false` constant, so it ends up adding no runtime overhead. If the value is `false`, the whole `if` block evaporates. But if it’s `true`, that necessarily means the argument passed to the method is recognized by the JIT as being a constant, e.g. a developer called `someString.Contains("-")` such that the JIT can see that `value` is `"-"`. In such a case, the JIT also knows `value.Length`, such that it can see at compile time whether it’s `1` or not. And that in turn means this whole method becomes:

    public bool Contains(string value)
    {
        if (value == null)
            ThrowHelper.ThrowArgumentNullException(ExceptionArgument.value);
    
        return SpanHelpers.IndexOf(
            ref _firstChar,
            Length,
            ref value._firstChar,
            value.Length) >= 0;
    }

if the JIT can’t prove the argument is a constant or if it’s not exactly one character in length, or:

    public bool Contains(string value)
    {
        return Contains('the constant char');
    }

if it can. This eliminates a bit of overhead from the call.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private string _input = "!@#$%^&";
    
        [Benchmark]
        public bool Contains() => _input.Contains("$");
    }

Method

Runtime

Mean

Ratio

Contains

.NET 8.0

3.7649 ns

1.00

Contains

.NET 9.0

0.9614 ns

0.26

### Regex

Regular expression support in .NET has received a lot of love over the past few years. The implementation was overhauled in [.NET 5](https://devblogs.microsoft.com/dotnet/regex-performance-improvements-in-net-5/) to yield significant performance gains, and then in [.NET 7](https://devblogs.microsoft.com/dotnet/regular-expression-improvements-in-dotnet-7/) it not only saw another round of huge performance gains, it also gained a source generator, a new non-backtracking implementation, and more. In .NET 8, it saw [additional performance improvements](https://devblogs.microsoft.com/dotnet/performance-improvements-in-net-8/#regex), in part because of using `SearchValues`.

Now in .NET 9, the trend continues. First and foremost, it’s important to recognize that many of the changes discussed thus far implicitly accrue to `Regex`. `Regex` already uses `SearchValues`, and so improvements to `SearchValues` benefit `Regex` (it’s one of my favorite things about working at the lowest levels of the stack: improvements there have a multiplicative effect, in that direct use of them improves, but so too does indirect use via intermediate components that instantly get better as the lower level does). Beyond that, though, `Regex` has increased its reliance on `SearchValues`.

There are multiple engines backing `Regex` today:

*   An interpreter, which is what you get when you don’t explicitly ask for one of the other engines.
*   A reflection-emit-based compiler, which at run-time emits custom IL for the specific regular expression and options. This is what you get when you specify `RegexOptions.Compiled`.
*   A non-backtracking engine, which doesn’t support all of `Regex`‘s features but which guarantees `O(N)` throughput in the length of the input. This is what you get when you specify `RegexOptions.NonBacktracking`.
*   And a source generator, which is very similar to the compiler, except it emits C# at build-time rather than emitting IL at run-time. This is what you get when you use `[GeneratedRegex(...)]`.

As of [dotnet/runtime#98791](https://github.com/dotnet/runtime/pull/98791), [dotnet/runtime#103496](https://github.com/dotnet/runtime/pull/103496), and [dotnet/runtime#98880](https://github.com/dotnet/runtime/pull/98880), all of the engines other than the interpreter avail themselves of the new `SearchValues<string>` support (the interpreter could as well, but we make an assumption that someone is using the interpreter in order to optimize for the speed of `Regex` construction, and the analyses involved in choosing to use `SearchValues<string>` can take measurable time). The best way to see what this looks like is via the source generator, as we can easily examine the code it outputs in both .NET 8 and .NET 9. Consider this code:

    using System.Text.RegularExpressions;
    
    internal partial class Example
    {
        [GeneratedRegex("(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday): (.*)", RegexOptions.IgnoreCase)]
        public static partial Regex ParseEntry();
    }

In Visual Studio, you can right-click on `ParseEntry`, select “Go To Definition,” and the tool will take you to the C# code for this pattern as generated by the regular expression source generator (the pattern is looking for a day of the week, followed by a colon, then followed by any text, and is capturing both the day and that subsequent text into capture groups for subsequent exploration). The generated code contains two relevant methods: a `TryFindNextPossibleStartingPosition` method, which is used to skip ahead as quickly as possible to the first location that might possibly match, and a `TryMatchAtCurrentPosition` method, which performs the full match attempt at that location. For our purposes here, we care about `TryFindNextPossibleStartingPosition`, as that’s the most impactful place `SearchValues` shows up. On .NET 8, we see this code:

    private bool TryFindNextPossibleStartingPosition(ReadOnlySpan<char> inputSpan)
    {
        int pos = base.runtextpos;
        ulong charMinusLowUInt64;
    
        // Any possible match is at least 8 characters.
        if (pos <= inputSpan.Length - 8)
        {
            // The pattern matches a character in the set [ADSYadsy] at index 5.
            // Find the next occurrence. If it can't be found, there's no match.
            ReadOnlySpan<char> span = inputSpan.Slice(pos);
            for (int i = 0; i < span.Length - 7; i++)
            {
                int indexOfPos = span.Slice(i + 5).IndexOfAny(Utilities.s_ascii_1200080212000802);
                if (indexOfPos < 0)
                {
                    goto NoMatchFound;
                }
                i += indexOfPos;
    
                if (((long)((0x8106400081064000UL << (int)(charMinusLowUInt64 = (uint)span[i] - 'F')) & (charMinusLowUInt64 - 64)) < 0) &&
                    ((long)((0x8023400080234000UL << (int)(charMinusLowUInt64 = (uint)span[i + 3] - 'D')) & (charMinusLowUInt64 - 64)) < 0))
                {
                    base.runtextpos = pos + i;
                    return true;
                }
            }
        }
    
        // No match found.
        NoMatchFound:
        base.runtextpos = inputSpan.Length;
        return false;
    }

The code is using an `IndexOfAny` with `Utilities.s_ascii_1200080212000802`; what is that? It’s a `SearchValues<char>`:

    /// <summary>Supports searching for characters in or not in "ADSYadsy".</summary>
    internal static readonly SearchValues<char> s_ascii_1200080212000802 = SearchValues.Create("ADSYadsy");

The source generator is employing the approach we looked at earlier, searching for a single character from each string. Here it’s decided that its best chance for an optimal search is to look for the character at offset 5 in each string, so ‘y’ for “Monday”, ‘a’ for “Tuesday”, etc., plus looking for the upper-case variants since `RegexOptions.IgnoreCase` was specified. Then after the single-character search, it’s doing a quick test for a couple of other positions in the string to try to weed out false positives, looking at the 0th offset to ensure the character is in the set `[MTWFSmtwfs]` and the 3rd offset to ensure the character is in the set `[DSNRUdsnru]`. (The check for those is obscured by it using a branchless technique to query a bitmap stored in a 64-bit ulong.)

Now, here’s what we get in .NET 9:

    private bool TryFindNextPossibleStartingPosition(ReadOnlySpan<char> inputSpan)
    {
        int pos = base.runtextpos;
    
        // Any possible match is at least 8 characters.
        if (pos <= inputSpan.Length - 8)
        {
            // The pattern has multiple strings that could begin the match. Search for any of them.
            // If none can be found, there's no match.
            int i = inputSpan.Slice(pos).IndexOfAny(Utilities.s_indexOfAnyStrings_OrdinalIgnoreCase_B7E3C0B8368AC400913BEA56D1872F43698FDA2C54D1AD4886F6734244613374);
            if (i >= 0)
            {
                base.runtextpos = pos + i;
                return true;
            }
        }
    
        // No match found.
        base.runtextpos = inputSpan.Length;
        return false;
    }

Again, we see an `IndexOfAny`, but notice that the subsequent checks for other positions are gone. Why? Because that `SearchValues` being passed to the `IndexOfAny` now is a `SearchValues<string>`, and thus already confirms that one of the provided strings matches:

    /// <summary>Supports searching for the specified strings.</summary>
    internal static readonly SearchValues<string> s_indexOfAnyStrings_OrdinalIgnoreCase_B7E3C0B8368AC400913BEA56D1872F43698FDA2C54D1AD4886F6734244613374 =
        SearchValues.Create(
            ["monday", "tuesday", "wednesda", "thursday", "friday", "saturday", "sunday"], 
            StringComparison.OrdinalIgnoreCase);

The sharp-eyed amongst you might notice that there’s no ‘y’ at the end of “Wednesday”; that’s simply due to a heuristic in the `Regex` implementation. When it searches for strings to use as part of such a `SearchValues<string>`, it limits itself to using no more than length 8 strings. And “searches” is an appropriate word here, as the implementation isn’t limited just to clean alternations as in the previous example. If I instead change the program to be:

    using System.Text.RegularExpressions;
    
    internal partial class Example
    {
        [GeneratedRegex("[Aa]([Bb][Cc]|[Dd][Ee])")]
        public static partial Regex ParseEntry();
    }

we still end up with a `SearchValues<string>`, now for this:

    /// <summary>Supports searching for the specified strings.</summary>
    internal static readonly SearchValues<string> s_indexOfAnyStrings_OrdinalIgnoreCase_33A76C255741CD9630059173F803FB92EBDDFBF62328261428CF8838D6379CE9 =
        SearchValues.Create(["abc", "ade"], StringComparison.OrdinalIgnoreCase);

Interestingly, as of [dotnet/runtime#96402](https://github.com/dotnet/runtime/pull/96402), `SearchValues<string>` will also be used when doing a single string search. As previously noted, `IndexOf(string)` will try to pick two characters and do a vectorized search for both, whereas `SearchValues<string>` for that same input can spend a bit more time trying to pick more characters and characters that will be better for the search. As such, `Regex` now opts to use `SearchValues<string>` as part of `TryFindNextPossibleStartingPosition`. We can see this with the following benchmarks that count the number of occurrences of the words “Hello” or “earth”:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Text.RegularExpressions;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public partial class Tests
    {
        public static readonly string s_markTwain = new HttpClient().GetStringAsync("https://www.gutenberg.org/cache/epub/3200/pg3200.txt").Result;
    
        [GeneratedRegex(@"\bHello\b")]
        public static partial Regex FindHello();
    
        [GeneratedRegex(@"\bearth\b")]
        public static partial Regex FindEarth();
    
        [Benchmark]
        public int CountHello() => FindHello().Count(s_markTwain);
    
        [Benchmark]
        public int CountEarth() => FindEarth().Count(s_markTwain);
    }

On .NET 8, the code generated for `TryFindNextPossibleStartingPosition` for `FindEarth` includes:

    int i = inputSpan.Slice(pos).IndexOf("earth");

whereas on .NET 9, the generated code is:

    int i = inputSpan.Slice(pos).IndexOfAny(Utilities.s_indexOfString_earth_Ordinal);
    ...
    internal static readonly SearchValues<string> s_indexOfString_earth_Ordinal =
        SearchValues.Create(["earth"], StringComparison.Ordinal);

And the results:

Method

Runtime

Mean

Ratio

CountHello

.NET 8.0

2.020 ms

1.00

CountHello

.NET 9.0

2.042 ms

1.01

CountEarth

.NET 8.0

2.738 ms

1.00

CountEarth

.NET 9.0

2.339 ms

0.85

This highlights that using `SearchValues<string>` in this one-string case doesn’t always help, but it can improve things, in particular in situations where the extra one-time work done by the `SearchValues.Create` enables it to find meaningfully better characters for which to search.

My seeming obsession with `SearchValues<T>` might lead one to believe that it’s the only source of improvements in `Regex`, but that’s far from the truth. There are many other PRs in .NET 9 focused on different aspects that improved the area.

[dotnet/runtime#93190](https://github.com/dotnet/runtime/pull/93190) is a nice addition. One of the optimizations introduced to `Regex` in .NET 7 was a “literal-after-loop” search. A lot of effort goes into finding ways to help `Regex`‘s `TryFindNextPossibleStartingPosition` be as efficient as possible at skipping unnecessary locations, and this “literal-after-loop” search is one such mechanism. It looks for a particular shape of pattern, where the pattern starts with a loop that’s then followed by a literal. For example, the industry regex benchmarks in [mariomka/regex-benchmark](https://github.com/mariomka/regex-benchmark/blob/17d073ec864931546e2694783f6231e4696a9ed4/csharp/Benchmark.cs) includes this pattern for finding URIs:

    @"[\w]+://[^/\s?#]+[^\s?#]+(?:\?[^\s#]*)?(?:#[^\s]*)?"

The pattern starts with a word character loop. We don’t have a good way to vectorize a search for any word character, nor would we really want to; there are over 50,000 word characters that are part of the `\w` set, and in most inputs we’d typically find an occurrence so quickly that it wouldn’t be worth the vectorization. However, the `"://"` that follows is easily searchable and much less likely to occur, making it a good candidate for `TryFindNextPossibleStartingPosition`. However, we can’t just search for the `"://"` because it doesn’t start the pattern, nor is it at a fixed-offset from the beginning of the pattern that would enable us to find the `"://"` and then jump backwards a known number of positions. Instead, with the “literal-after-loop” optimization, we can find the `"://"` and then iterate backwards to the beginning of the loop in order to find the actual starting position for the match attempt (we can also keep track of where the loop ends so that we don’t need to re-match it).

There were, however, a number of gaps in this optimization. Most notably, the implementation needs to examine the pattern to determine whether it’s applicable. If the starting loop was wrapped in a capture or an atomic group, it was unnecessarily giving up and would fail to discover the loop for the purposes of enabling the “literal-after-loop” mechanism. The search would also give up if the literal after the loop was a set inside of various grouping constructs, like a concatenation.

This PR fixed those gaps. The impact of this can be seen by looking at another industry benchmark, this time from the [BurntSushi/rebar](https://github.com/BurntSushi/rebar#ruff-noqa) repo:

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Text.RegularExpressions;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public partial class Tests
    {
        private static string s_haystack = new HttpClient().GetStringAsync("https://raw.githubusercontent.com/BurntSushi/rebar/master/benchmarks/haystacks/wild/cpython-226484e4.py").Result;
    
        [GeneratedRegex(@"(\s*)((?:# [Nn][Oo][Qq][Aa])(?::\s?(([A-Z]+[0-9]+(?:[,\s]+)?)+))?)")]
        private static partial Regex RuffNoQA();
    
        [Benchmark]
        public int Count() => RuffNoQA().Count(s_haystack);
    }

The impact of the literal-after-loop optimization ends up being obvious in the resulting numbers:

Method

Runtime

Mean

Ratio

Count

.NET 8.0

197.47 ms

1.00

Count

.NET 9.0

18.67 ms

0.09

Improvements in `Regex` go beyond just the initial searching, as well. An interesting changes comes in [dotnet/runtime#98723](https://github.com/dotnet/runtime/pull/98723), not because it results in massive performance improvements (though it does yield some nice benefits), but rather because it highlights how improvement possibilities can be found in all manner of places. One of the areas we (and pretty much everyone else in the world it seems) has been investing a lot of energy into lately is AI, including into tokenizers, which are components that take text and translate it into a series of numbers that are meaningful to the model into which they’ll be fed. Each model is trained on a set of tokens from a specific tokenizer, and in the case of OpenAI’s models, that tokenizer algorithm is “tiktoken.” The official .NET implementation of tiktoken lives in the [Microsoft.ML.Tokenizers](https://www.nuget.org/packages/Microsoft.ML.Tokenizers) library, and as part of implementing tiktoken, it follows the reference implementation provided by OpenAI, which uses [a regular expression as part of parsing](https://github.com/openai/tiktoken/blob/c0ba74c238d18b4824c25f3c27fc8698055b9a76/tiktoken_ext/openai_public.py#L103); for consistency and to help ensure correctness, therefore, the .NET implementation does as well. This regex includes the following pattern:

    (?i:'s|'t|'re|'ve|'m|'ll|'d)

What jumped out about this pattern is that it should trigger an optimization in the regex source generator that emits alternations like this as a C# `switch` statement, as the analyzer should be able to determine that all branches of the alternation are distinct, such that picking one branch because the first character matches necessarily means that no other branch could match. The benefit of a `switch` here is it allows the C# compiler to implement a jump table, which means we’re not stuck exploring each branch when we could instead jump right to the correct one. But that optimization wasn’t kicking in. Why? A series of unfortunate events. An earlier optimization was seeing the `ll` and rewriting that into a repeater (`l{2}`), which then defeated this alternation optimization because the implementation wasn’t written to examine loops. Loops were explicitly being skipped because a loop could be empty, and if empty, it wouldn’t have a first character required by the `switch`. However, we can see whether a loop has a non-zero minimum bound on number of iterations set, as it does in this case, and in such cases we can still factor in up to that minimum number, which are all guaranteed iterations. This PR improved the analysis to handle loops well, as evidenced by this micro-benchmark (which has been crafted to accentuate this aspect of the pattern):

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Text.RegularExpressions;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public partial class Tests
    {
        private static string s_haystack = new string('y', 10_000);
    
        [GeneratedRegex("(?i:a|bb|c|dd|e|ff|g|hh|i|jj|k|ll|m|nn|o|pp|q|rr|s|tt|u|vv|w|xx|y|zz)")]
        public static partial Regex Parse();
    
        [Benchmark]
        public int Count() => Parse().Count(s_haystack);
    }

Method

Runtime

Mean

Ratio

Count

.NET 8.0

315.7 us

1.00

Count

.NET 9.0

211.6 us

0.67

The non-backtracking engine also got some nice attention in .NET 9. [dotnet/runtime#102655](https://github.com/dotnet/runtime/pull/102655) from [@ieviev](https://github.com/ieviev) (who submitting a small subset of the changes they’d made as part of some exciting [regex research](http://arxiv.org/abs/2407.20479) being done in a fork of the library), followed by [dotnet/runtime#104766](https://github.com/dotnet/runtime/pull/104766) and [dotnet/runtime#105668](https://github.com/dotnet/runtime/pull/105668) made a variety of changes to the non-backtracking implementation, including:

*   **DFA limits.** The non-backtracking implementation works by constructing a finite automata, which can be thought of as a graph, with the implementation walking around the graph as it consumes additional characters from the input and uses those to guide what node(s) it transitions to next. The graph is built out lazily, such that nodes are only added as those states are explored, and the nodes can be one of two kinds: DFA (deterministic) or NFA (non-deterministic). DFA nodes ensure that for any given character that comes next in the input, there’s only ever one possible node to which to transition. Not so for NFA, where at any point in time there’s a list of all the possible nodes the system could be in, and moving to the next state means examining each of the current states, finding all possible transitions out of each, and treating the union of all of those new positions as the next state. DFA is thus _much_ cheaper than NFA in terms of the overheads involved in walking around the graph, and we want to fall back to NFA only when we absolutely have to, which is when the DFA graph would be too large: some patterns have the potential to create massive numbers of DFA nodes. Thus, there’s a threshold where once that number of constructed nodes in the graph is hit, new nodes are constructed as NFA rather than DFA. In .NET 8 and earlier, that limit was somewhat arbitrarily set at 10,000. For .NET 9 as part of this PR, analysis was done to show that a much higher limit was worth the memory trade-offs, and the limit was raised to 125,000, which means many more patterns can fully execute as DFA.
*   **Minterm mappings.** The implementation works in terms of “minterms,” which are equivalence classes for all characters that behave the same in the pattern. For example, with the pattern `"[a-z]*"`, the lowercase ASCII letters are all treated the same and are all treated differently from every other character, so there are two minterms here, one for the 26 lowercase ASCII letters, and the other for the remaining 65,510 characters. This is used as a compression mechanism, as rather than needing to describe the transitions between nodes for every character, the system can instead do so for every minterm. Of course, that means during matching there’s a step where a character needs to be mapped to its minterm in order to know which edge to follow to the next state. Previously, that mapping was cached for all ASCII characters but recomputed each time for non-ASCII (recomputing it amounts to a binary search on a tree data structure). As you can imagine, this can lead to significant overhead when non-ASCII is encountered. Now in .NET 9, mappings for all characters represented in the pattern are stored. In degenerate cases, this can measurably increase memory consumption for the `Regex` instance, but on average it doesn’t; in fact, for common cases the new scheme actually reduces memory consumption, as it takes into account the fact that all but the most niche patterns have fewer than 256 minterms, and the per-character mapping can thus be stored in a `byte` rather than a `ushort` or `uint`. Additionally, for cases where only a subset of ASCII is used in the pattern (which is common), the `Regex` instance needn’t allocate an array to represent all 128 ASCII characters, but can instead be shrunk to only support those characters that need be represented.
*   **Timeout checks.** `Regex` has long supported a timeout mechanism, where if a match operation takes longer than a specified limit, an exception is thrown. This mechanism exists to help mitigate possible regex denial of service (ReDOS) attacks, where a maliciously-constructed pattern when fed to a backtracking engine could lead to “catastrophic backtracking” (you can see an example of this in my [Deep .NET discussion on Regex](https://www.youtube.com/watch?v=ptKjWPC7pqw) with Scott Hanselman). These timeouts are thus enabled in the interpreter, the compiler, and the source generator. For the non-backtracking engine, timeouts aren’t necessary to avoid catastrophic backtracking, as there is no backtracking. The engine still pays some attention to timeouts, though, purely for consistency with the other engines, yet the frequency of the checks was actually adding measurable overhead in some cases. The PR reduced the frequency of the checks to mitigate that overhead while not meaningfully affecting the effectiveness of the checks.
*   **Hot path inner loop.** The inner matching loop is the hot path for a matching operation: read the next character, look up its minterm, follow the corresponding edge to the next node in the graph, rinse and repeat. Performance of the engine is tied to efficiency of this loop. These PRs recognized that there were some checks being performed in that inner loop which were only relevant to a minority of patterns. For the majority, the code could be specialized such that those checks wouldn’t be needed in the hot path.
*   **General good hygiene.** Care was taken to remove unnecessary overheads, such as duplicate array lookups that could be removed, bounds checks that could be avoided, indirect reads via `ref`s that could instead be done against locals, and so on.

The net result of these changes is most patterns get faster, some significantly, especially on non-ASCII inputs.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Text.RegularExpressions;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        public static readonly string s_aristotle = new HttpClient().GetStringAsync("https://www.gutenberg.org/cache/epub/39963/pg39963.txt").Result;
        private readonly Regex _word = new Regex(@"\b[\p{IsGreek}]+\b", RegexOptions.NonBacktracking);
    
        [Benchmark]
        public int CountWords() => _word.Matches(s_aristotle).Count;
    }

Method

Runtime

Mean

Ratio

CountWords

.NET 8.0

14.808 ms

1.00

CountWords

.NET 9.0

9.673 ms

0.65

The [dotnet/runtime](https://github.com/dotnet/runtime) employs an automated performance regression testing system, with tests in [dotnet/performance](https://github.com/dotnet/performance) constantly running on various operating systems and hardware, with the goal of detecting regressions. When a possible regression is noticed, an issue is opened containing the details. However, the system also notices statistically-significant improvements and also opens issues on those, just to ensure that we’re all aware of when and how things change in a meaningful way. When possible, the issues reference the PR known to have caused the regression or improvement, so it’s always a treat to see a list of references like this on a PR, as was the case with [dotnet/runtime#102655](https://github.com/dotnet/runtime/pull/102655): ![Automated performance analysis links](https://devblogs.microsoft.com/dotnet/wp-content/uploads/sites/10/2024/09/AutomatedPerfAnalysisImprovementsRegex.png)

Both the non-backtracking engine and the interpreter now also gain additional optimized searching for certain classes of prefixes they didn’t previously support. With [dotnet/runtime#100315](https://github.com/dotnet/runtime/pull/100315), patterns that begin with ranges can now be optimized with an `IndexOfAny{Except}InRange` call, whereas previously such patterns would likely result in walking character by character.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Text.RegularExpressions;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        public static readonly string s_markTwain = new HttpClient().GetStringAsync("https://www.gutenberg.org/cache/epub/3200/pg3200.txt").Result;
    
        private readonly Regex _interpreter = new Regex(@"\b[0-9]+\b");
        private readonly Regex _nonBacktracking = new Regex(@"\b[0-9]+\b", RegexOptions.NonBacktracking);
    
        [Benchmark]
        public int Interpreter() => _interpreter.Count(s_markTwain);
    
        [Benchmark]
        public int NonBacktracking() => _nonBacktracking.Count(s_markTwain);
    }

Method

Runtime

Mean

Ratio

Interpreter

.NET 8.0

21.223 ms

1.00

Interpreter

.NET 9.0

1.726 ms

0.08

NonBacktracking

.NET 8.0

21.945 ms

1.00

NonBacktracking

.NET 9.0

1.749 ms

0.08

Finally, `Regex` gains some new APIs in .NET 9, focused on performance. `Regex` currently has a set of `Split` overloads; these logically behave like `Match`, except instead of returning what matched, they effectively return what’s between the matches, treating the match as a split separator. As with `string.Split`, these `Regex.Split` methods return a `string[]`, which means allocating the array to store all the results and allocating each of the individual `string`s. There was also no overload for supporting span inputs, which meant if one had a span to search, that span would first need to be converted into a string, yet another allocation. .NET 7 saw a similar predicament fixed with the introduction of the `EnumerateMatches` method, which provided an allocation-free alternative to `Match` or `Matches`. Now in .NET 9, thanks to [dotnet/runtime#103307](https://github.com/dotnet/runtime/pull/103307), `Regex` gets new `EnumerateSplits` methods, that similarly provide an allocation-free way to access the same splits. The method accepts a `ReadOnlySpan<char>`, and then rather than returning an array of strings, it returns an enumerator of `Range`s pointing into the original.

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Text.RegularExpressions;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        public static readonly string s_markTwain = new HttpClient().GetStringAsync("https://www.gutenberg.org/cache/epub/3200/pg3200.txt").Result;
        private readonly Regex _whitespace = new Regex(@"\s+", RegexOptions.Compiled);
    
        [Benchmark(Baseline = true)]
        public int SplitOnWhitespace_Split()
        {
            int lengths = 0;
            foreach (string split in _whitespace.Split(s_markTwain))
            {
                lengths += split.Length;
            }
            return lengths;
        }
    
        [Benchmark]
        public int SplitOnWhitespace_EnumerateSplits()
        {
            int lengths = 0;
            foreach (Range range in _whitespace.EnumerateSplits(s_markTwain))
            {
                ReadOnlySpan<char> split = s_markTwain.AsSpan(range);
                lengths += split.Length;
            }
            return lengths;
        }
    }

Method

Mean

Ratio

Allocated

Alloc Ratio

SplitOnWhitespace\_Split

189.1 ms

1.00

185305389 B

1.000

SplitOnWhitespace\_EnumerateSplits

116.6 ms

0.62

272 B

0.000

### Encoding

Base64 encoding has been supported in .NET since the beginning, with methods like `Convert.ToBase64String` and `Convert.FromBase64CharArray`. More recently, a plethora of Base64-related APIs have been added, including span-based APIs on `Convert` but also a dedicated `System.Buffers.Text.Base64` with methods for encoding and decoding between arbitrary bytes and UTF8 text, and most recently for very efficiently checking whether UTF8 and UTF16 text represents a valid Base64 payload.

Base64 is a fairly simple encoding scheme for taking arbitrary binary data and converting it to ASCII text, splitting the input up into groups of 6 bits (2^6 == 64 possible values) and mapping each of those values to a specific character in the Base64 alphabet: the 26 upper-case ASCII letters, the 26 lower-case ASCII letters, the 10 ASCII digits, `'+'`, and `'/'`. While this is an incredibly popular encoding mechanism, it runs into problems for some use cases because of the exact choice of alphabet. Including Base64 data in a URI is possibly problematic, as `'+'` and `'/'` both have special meaning in URIs, as does the special `'='` symbol used for padding Base64 data out to a specific length. That means that in addition to Base64-encoding data, the resulting data might also need to be URL-encoded for such a use, both taking additional time and further increasing the size of the payload. To address this, a variant was introduced, Base64Url, which does away with the need for padding, and which uses a slightly different alphabet, `'-'` instead of `'+'` and `'_'` instead of `'/'`. Base64Url is used in a variety of domains, including as part of [JSON Web Tokens (JWT)](https://en.wikipedia.org/wiki/JSON_Web_Token), where it’s used to encode each segment of the token.

While .NET has had Base64 support for a long time, it hasn’t had Base64Url support, and as such, developers have had to craft their own. Many have done so by layering on top of the Base64 implementations in `Convert` or `Base64`. For example, here’s what the core part of ASP.NET’s implementation for `WebEncoders.Base64UrlEncode` looked like in .NET 8:

    private static int Base64UrlEncode(ReadOnlySpan<byte> input, Span<char> output)
    {
        if (input.IsEmpty)
            return 0;
    
        Convert.TryToBase64Chars(input, output, out int charsWritten);
    
        for (var i = 0; i < charsWritten; i++)
        {
            var ch = output[i];
            if (ch == '+') output[i] = '-';
            else if (ch == '/') output[i] = '_';
            else if (ch == '=') return i;
        }
    
        return charsWritten;
    }

We can obviously write more code to do that more efficiently, but with .NET 9 we don’t have to. With [dotnet/runtime#102364](https://github.com/dotnet/runtime/pull/102364), .NET now has a fully-featured `Base64Url` type that is also very efficient. It actually shares almost all of its implementation with the same functionality on `Base64` and `Convert`, using generic tricks to substitute the different alphabets in an optimized manner. (The ASP.NET implementation has also been updated to use `Base64Url` with [dotnet/aspnetcore#56959](https://github.com/dotnet/aspnetcore/pull/56959) and [dotnet/aspnetcore#57050](https://github.com/dotnet/aspnetcore/pull/57050).)

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Buffers.Text;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private byte[] _data;
        private char[] _destination = new char[Base64.GetMaxEncodedToUtf8Length(1024 * 1024)];
    
        [GlobalSetup]
        public void Setup()
        {
            _data = new byte[1024 * 1024];
            new Random(42).NextBytes(_data);
        }
    
        [Benchmark(Baseline = true)]
        public int Old() => Base64UrlOld(_data, _destination);
    
        [Benchmark]
        public int New() => Base64Url.EncodeToChars(_data, _destination);
    
        static int Base64UrlOld(ReadOnlySpan<byte> input, Span<char> output)
        {
            if (input.IsEmpty)
                return 0;
    
            Convert.TryToBase64Chars(input, output, out int charsWritten);
    
            for (var i = 0; i < charsWritten; i++)
            {
                var ch = output[i];
                if (ch == '+')
                {
                    output[i] = '-';
                }
                else if (ch == '/')
                {
                    output[i] = '_';
                }
                else if (ch == '=')
                {
                    return i;
                }
            }
    
            return charsWritten;
        }
    }

Method

Mean

Ratio

Old

1,314.20 us

1.00

New

81.36 us

0.06

This also benefits from a set of changes that improved the performance of `Base64`, and thus also `Base64Url`, since they now share the same code. [dotnet/runtime#92241](https://github.com/dotnet/runtime/pull/92241) from [@DeepakRajendrakumaran](https://github.com/DeepakRajendrakumaran) added an AVX512-optimized Base64 encoding/decoding implementation, and [dotnet/runtime#95513](https://github.com/dotnet/runtime/pull/95513) from [@SwapnilGaikwad](https://github.com/SwapnilGaikwad) and [dotnet/runtime#100589](https://github.com/dotnet/runtime/pull/100589) from [@SwapnilGaikwad](https://github.com/SwapnilGaikwad) optimized Base64 encoding and decoding for Arm64.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private byte[] _toEncode;
        private char[] _encoded;
    
        [GlobalSetup]
        public void Setup()
        {
            _toEncode = new byte[1000];
            new Random(42).NextBytes(_toEncode);
            _encoded = new char[Convert.ToBase64String(_toEncode).Length];
        }
    
        [Benchmark]
        public void ConvertToBase64() => Convert.ToBase64CharArray(_toEncode, 0, _toEncode.Length, _encoded, 0);
    }

Method

Runtime

Mean

Ratio

ConvertToBase64

.NET 8.0

104.55 ns

1.00

ConvertToBase64

.NET 9.0

60.19 ns

0.58

Another simpler form of encoding is hex, effectively employing an alphabet of 16 characters (for each group of 4 bits) rather than 64 (for each group of 6 bits). .NET 5 introduced the `Convert.ToHexString` set of methods, which take an input `ReadOnlySpan<byte>` or `byte[]` and produce an output `string` with two hex chars per input byte. The alphabet selected for that encoding are the hexademical characters of ‘0’ through ‘9’ and then upper-case ‘A’ through ‘F’. That’s great when you want upper-case, but sometimes you want the lower-case ‘a’ through ‘f’ instead. As a result, it’s not uncommon now to see calls like this:

    string result =  Convert.ToHexString(bytes).ToLowerInvariant();

where `ToHexString` produces one string and then `ToLowerInvariant` possibly produces another (“possibly” because it’ll only need to create a new string if the data contained any letters). With .NET 9 and [dotnet/runtime#92483](https://github.com/dotnet/runtime/pull/92483) from [@determ1ne](https://github.com/determ1ne), the new `Convert.ToHexStringLower` methods may be used to go directly to the lower-case version; that PR also introduced the `TryToHexString` and `TryToHexStringLower` methods, which format directly into a provided destination span rather than allocating anything.

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Buffers.Text;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private byte[] _data = new byte[100];
        private char[] _dest = new char[200];
    
        [GlobalSetup]
        public void Setup() => new Random(42).NextBytes(_data);
    
        [Benchmark(Baseline = true)]
        public string Old() => Convert.ToHexString(_data).ToLowerInvariant();
    
        [Benchmark]
        public string New() => Convert.ToHexStringLower(_data).ToLowerInvariant();
    
        [Benchmark]
        public bool NewTry() => Convert.TryToHexStringLower(_data, _dest, out int charsWritten);
    }

Method

Mean

Ratio

Allocated

Alloc Ratio

Old

136.69 ns

1.00

848 B

1.00

New

119.09 ns

0.87

424 B

0.50

NewTry

21.97 ns

0.16

–

0.00

Before .NET 5 introduced `Convert.ToHexString`, there actually already was some functionality in .NET for converting bytes to hex: `BitConverter.ToString`. `BitConverter.ToString` does the same thing `Convert.ToHexString` now does, except inserting dashes between every two hex characters (i.e. between every byte). As a result, it became fairly common for folks that wanted the equivalent of `ToHexString` to instead write `BitConverter.ToString(bytes).Replace("-", "")`. It’s so common to want the dashes removed, in fact, that it’s what GitHub copilot suggests for me just by typing `BitConverter.ToString`: ![GitHub copilot suggesting use of BitConverter.ToString](https://devblogs.microsoft.com/dotnet/wp-content/uploads/sites/10/2024/09/CopilotSuggestingBitConverterReplace.png) Of course, that operation is much more expensive (and more complicated) than just using `Convert.ToHexString`, so it’d be nice to help developers switch over to `ToHexString{Lower}`. That’s exactly what [dotnet/roslyn-analyzers#6967](https://github.com/dotnet/roslyn-analyzers/pull/6967) from [@mpidash](https://github.com/mpidash) does. [CA1872](https://learn.microsoft.com/dotnet/fundamentals/code-analysis/quality-rules/ca1872) will now flag both cases that can be converted to `Convert.ToHexString`: ![CA1872 analyzer for Convert.ToHexString](https://devblogs.microsoft.com/dotnet/wp-content/uploads/sites/10/2024/09/CA1872Upper.png) and cases that can be converted to `Convert.ToHexStringLower`: ![CA1872 analyzer for Convert.ToHexStringLower](https://devblogs.microsoft.com/dotnet/wp-content/uploads/sites/10/2024/09/CA1872Lower.png) And that’s good for performance, as the difference is quite stark:

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private byte[] _bytes = Enumerable.Range(0, 100).Select(i => (byte) i).ToArray();
    
        [Benchmark(Baseline = true)]
        public string WithBitConverter() => BitConverter.ToString(_bytes).Replace("-", "").ToLowerInvariant();
    
        [Benchmark]
        public string WithConvert() => Convert.ToHexStringLower(_bytes);
    }

Method

Mean

Ratio

Allocated

Alloc Ratio

WithBitConverter

1,707.46 ns

1.00

1472 B

1.00

WithConvert

61.66 ns

0.04

424 B

0.29

There are a variety of reasons for that difference, including the obvious one that the `Replace` is having to search the input, find all the dashes, and allocate a brand new string without them. However, `BitConverter.ToString` is also slower in general as it’s not as easily vectorized, due to needing to insert dashes between the resulting characters.

In the other direction, `Convert.FromHexString` decodes a string of hex back into a new `byte[]`. [dotnet/runtime#86556](https://github.com/dotnet/runtime/pull/86556) from [@hrrrrustic](https://github.com/hrrrrustic) adds overloads of `FromHexString` that write into a destination span rather than allocating a new `byte[]` each time.

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Buffers;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private string _hex = string.Concat(Enumerable.Repeat("0123456789abcdef", 10));
        private byte[] _dest = new byte[100];
    
        [Benchmark(Baseline = true)]
        public byte[] FromHexString() => Convert.FromHexString(_hex);
    
        [Benchmark]
        public OperationStatus FromHexStringSpan() => Convert.FromHexString(_hex.AsSpan(), _dest, out int charsWritten, out int bytesWritten);
    }

Method

Mean

Ratio

Allocated

Alloc Ratio

FromHexString

33.78 ns

1.00

104 B

1.00

FromHexStringSpan

18.22 ns

0.54

–

0.00

### Span, Span, and more Span

The introduction of `Span<T>` and `ReadOnlySpan<T>` back in .NET Core 2.1 have revolutionized how we write .NET code (especially in the core libraries) and what APIs we expose (see [A Complete .NET Developer’s Guide to Span](https://www.youtube.com/watch?v=5KdICNWOfEQ) if you’re interested in a deeper dive.) .NET 9 has continued the trend of doubling-down on spans as a great way to both implicitly provide performance boosts and also expose APIs that enables developers to do more for performance in their own code.

One great example of this is the new C# 13 support for “params collections,” which merged into the C# compiler’s main branch in [dotnet/roslyn#72511](https://github.com/dotnet/roslyn/pull/72511). This feature enables the C# `params` keyword to be used with more than just array parameters, but rather any collection type that’s usable with collection expressions… that includes span. In fact, the feature makes it so that if there are two overloads, one taking a `params T[]` and one taking a `params ReadOnlySpan<T>`, the latter overload will win overload resolution. Moreover, the code generated for a call site for a `params ReadOnlySpan<T>` is the same non-allocating approach you get for collection expressions, e.g. given code like this:

    using System;
    
    public class C 
    {
        public void M()
        {
            Helpers.DoAwesomeStuff("Hello", "World");
        }
    }
    
    public static class Helpers
    {
        public static void DoAwesomeStuff<T>(params T[] values) { }
        public static void DoAwesomeStuff<T>(params ReadOnlySpan<T> values) { }
    }

the IL the C# compiler generates for `C.M` will be equivalent to something like the following C#:

    <>y__InlineArray2<string> buffer = default;
    <PrivateImplementationDetails>.InlineArrayElementRef<<>y__InlineArray2<string>, string>(ref buffer, 0) = "Hello";
    <PrivateImplementationDetails>.InlineArrayElementRef<<>y__InlineArray2<string>, string>(ref buffer, 1) = "World";
    Helpers.DoAwesomeStuff(<PrivateImplementationDetails>.InlineArrayAsReadOnlySpan<<>y__InlineArray2<string>, string>(ref buffer, 2));

This is using the `[InlineArray]` feature introduced in .NET 8 to stack-allocate a span of strings, and then pass that span into the method. No heap allocation. This is awesome for library developers, because it means any place where you have a method taking a `params T[]`, you can add a `params ReadOnlySpan<T>` overload, and when consuming code calling that method recompiles, it just gets better. [dotnet/runtime#101308](https://github.com/dotnet/runtime/pull/101308) and [dotnet/runtime#101499](https://github.com/dotnet/runtime/pull/101499) rely on that to add ~40 new overloads for methods that didn’t previously accept spans and now do, and added `params` to over 20 existing overloads that were already taking spans. For example, if code had been using `Path.Join` to build up a path comprised of five or more segments, it previously would have been using the `params string[]` overload, but now upon recompilation it’ll switch to using the `params ReadOnlySpan<string>` overload, and won’t need to allocate a `string[]` for the inputs.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Buffers;
    using System.Numerics;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        public string Join() => Path.Join("a", "b", "c", "d", "e");
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

Join

.NET 8.0

30.83 ns

1.00

104 B

1.00

Join

.NET 9.0

24.85 ns

0.81

40 B

0.38

The C# compiler has also improved around spans in other ways. For example, [dotnet/roslyn#71261](https://github.com/dotnet/roslyn/pull/71261) extends the assembly data support for initializing arrays and `ReadOnlySpan<T>` to also apply to `stackalloc`. If you have code like this:

    var array = new char[] { 'a', 'b', 'c', 'd', 'e', 'f', 'g' };

the compiler will generate code along the lines of the following:

    char[] array = new char[7];
    RuntimeHelpers.InitializeArray(array, (RuntimeFieldHandle)&<PrivateImplementationDetails>.FD43C34A357FF620C00C04D0247059F8628CBB3DB349DF05DFA15EF6C7AC514C2);

The compiler has taken that char data and blit it into the assembly; then when it creates the array, rather than setting each individual value into the array, it just copies that data directly from the assembly into the array. Similarly, if you have:

    ReadOnlySpan<char> span = new char[] { 'a', 'b', 'c', 'd', 'e', 'f', 'g' };

the compiler recognizes that all of the data is constant and is being stored into a “read-only” location, so it doesn’t actually need to allocate an array. Instead, it emits code like:

    ReadOnlySpan<char> span =
    RuntimeHelpers.CreateSpan<char>((RuntimeFieldHandle)&<PrivateImplementationDetails>.FD43C34A357FF620C00C04D0247059F8628CBB3DB349DF05DFA15EF6C7AC514C2);

which effectively creates a span that points directly into the assembly data; no allocation _and_ no copy needed. However, if you have this:

    ReadOnlySpan<char> span = stackalloc char[] { 'a', 'b', 'c', 'd', 'e', 'f', 'g' };

or this:

    Span<char> span = stackalloc char[] { 'a', 'b', 'c', 'd', 'e', 'f', 'g' };

you’d get codegen more like this:

    char* ptr = stackalloc char[7];
    *(char*)ptr = 97;
    *(char*)(ptr + 1) = 98;
    *(char*)(ptr + 2) = 99;
    *(char*)(ptr + 3) = 100;
    *(char*)(ptr + 4) = 101;
    *(char*)(ptr + 5) = 102;
    *(char*)(ptr + 6) = 103;
    Span<char> span = new Span<char>(ptr, 7);

But now, thanks to [dotnet/roslyn#71261](https://github.com/dotnet/roslyn/pull/71261), that last example will also be unified with the same approach for the other constructions, resulting in code more like this:

    char* ptr = stackalloc char[7];
    Unsafe.CopyBlockUnaligned(ptr, &<PrivateImplementationDetails>.FD43C34A357FF620C00C04D0247059F8628CBB3DB349DF05DFA15EF6C7AC514C2, 14);
    Span<char> span = new Span<char>(ptr, 7);

(the compiler will actually generate a `cpblk` IL instruction rather than a call to `Unsafe.CopyBlockUnaligned`).

The C# compiler has also improved its ability to avoid allocations when creating `ReadOnlySpan<T>` from some expressed array constructions or collection expressions. One of the really nice optimizations the C# compiler added several years back was the ability to recognize when a new `byte`/`sbyte`/`bool` array was being constructed, filled with only constants, and directly assigned to a `ReadOnlySpan<T>`. In such a case, it would recognize that the data was all blittable and could never be modified, so rather than allocating an array and wrapping a span around it, it would blit the data into the assembly and then just construct a span around a pointer into the assembly data with the appropriate length. So this:

    ReadOnlySpan<byte> Values => new[] { (byte)0, (byte)1, (byte)2 };

got lowered into something more like this:

    ReadOnlySpan<byte> Values => new ReadOnlySpan<byte>(
        &<PrivateImplementationDetails>.AE4B3280E56E2FAF83F414A6E3DABE9D5FBE18976544C05FED121ACCB85B53FC),
        3);

The optimization at the time was limited to only single-byte primitive types because of endianness concerns, but .NET 7 added a `RuntimeHelpers.CreateSpan` method which handled such endianness concerns, so then this was expanded to all such primitive types regardless of size. So this:

    ReadOnlySpan<char> Values1 => new[] { 'a', 'b', 'c' };
    ReadOnlySpan<int> Values2 => new[] { 1, 2, 3 };
    ReadOnlySpan<long> Values3 => new[] { 1L, 2, 3 };
    ReadOnlySpan<DayOfWeek> Values4 => new[] { DayOfWeek.Monday, DayOfWeek.Friday };

gets lowered into something more like this:

    ReadOnlySpan<char> Values1 => new ReadOnlySpan<char>(
        &<PrivateImplementationDetails>.13E228567E8249FCE53337F25D7970DE3BD68AB2653424C7B8F9FD05E33CAEDF2),
        3);
    
    ReadOnlySpan<int> Values2 => new ReadOnlySpan<int>(
        &<PrivateImplementationDetails>.4636993D3E1DA4E9D6B8F87B79E8F7C6D018580D52661950EABC3845C5897A4D4),
        3);
    
    ReadOnlySpan<long> Values3 => new ReadOnlySpan<long>(
        &<PrivateImplementationDetails>.E2E2033AE7E19D680599D4EB0A1359A2B48EC5BAAC75066C317FBF85159C54EF8),
        3);
    
    ReadOnlySpan<DayOfWeek> Values3 => new ReadOnlySpan<DayOfWeek>(
        &<PrivateImplementationDetails>.ECA75F8497701D6223817CDE38BF42CDD1124E01EF6B705BCFE9A584F7B42F0F4),
        2);

Lovely. But… what about types that are supported as constants at the C# level but that aren’t blittable in this fashion? That includes `nint` and `nuint` (which vary in size based on the bitness of the process), `decimal` (for which a constant is actually represented in metadata via a `[DecimalConstant(...)]` attribute), and `string` (which is a reference type). In those cases, even though we’re still targeting something that can be mutated and we’re still using constants, we still get the array allocation:

    ReadOnlySpan<nint> Values1 => new nint[] { 1, 2, 3 };
    ReadOnlySpan<nuint> Values2 => new nuint[] { 1, 2, 3 };
    ReadOnlySpan<decimal> Values3 => new[] { 1m, 2m, 3m };
    ReadOnlySpan<string> Values4 => new[] { "a", "b", "c" };

which are lowered to, well, themselves, such that there’s still an allocation. Or, at least there was. Thanks to [dotnet/roslyn#69820](https://github.com/dotnet/roslyn/pull/69820), these cases are now handled as well. They’re addressed by lazily allocating an array that’s then cached for all subsequent use. So now, that same example gets lowered into the equivalent of something more like this:

    ReadOnlySpan<nint> Values1 =>
        <PrivateImplementationDetails>.4636993D3E1DA4E9D6B8F87B79E8F7C6D018580D52661950EABC3845C5897A4D_B8 ??=
        new nint[] { 1, 2, 3 };
    
    ReadOnlySpan<nuint> Values2 =>
        <PrivateImplementationDetails>.4636993D3E1DA4E9D6B8F87B79E8F7C6D018580D52661950EABC3845C5897A4D_B16 ??=
        new nuint[] { 1, 2, 3 };
    
    ReadOnlySpan<decimal> Values3 =>
        <PrivateImplementationDetails>.04B64E80BCEFE521678C4D6565B6EEBCE2791130A600CCB5D23E1B5538155110_B18 ??=
        new[] { 1m, 2m, 3m };
    
    ReadOnlySpan<string> Values4 =>
        <PrivateImplementationDetails>.13E228567E8249FCE53337F25D7970DE3BD68AB2653424C7B8F9FD05E33CAEDF_B11 ??=
        new[] { "a", "b", "c" };

There are, of course, many more span-related improvements in the libraries, too. One improvement for an existing span-related method is [dotnet/runtime#103728](https://github.com/dotnet/runtime/pull/103728), which further optimizes `MemoryExtensions.Count` used to count the number of occurrences of an element in a span. The implementation is vectorized, processing a vector’s worth of data at a time, e.g. if 256-bit vectors are hardware accelerated, and it’s searching `char`s, it’ll process 16 `char`s at a time (16 `char`s _2 bytes per `char`_ 8 bits per byte == 256). What happens if the number of elements isn’t an even multiple of 16? Then we’re left with some remaining elements after processing the last full vector. Previously the implementation would fall back to processing those remaining elements one at a time; now, it’ll process one last vector at the end of the input. Doing so means we’ll end up re-examining one or more elements we already examined, but that doesn’t really matter, as we can examine all of the elements in approximately the same number of instructions as processing just a single element.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Buffers;
    using System.Numerics;
    using System.Runtime.CompilerServices;
    using System.Runtime.InteropServices;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private char[][] _values = new char[10_000][];
    
        [GlobalSetup]
        public void Setup()
        {
            var rng = new Random(42);
            for (int i = 0; i < _values.Length; i++)
            {
                _values[i] = new char[rng.Next(0, 128)];
                rng.NextBytes(MemoryMarshal.AsBytes(_values[i].AsSpan()));
            }
        }
    
        [Benchmark]
        public int Count()
        {
            int count = 0;
            foreach (char[] numbers in _values)
            {
                count += numbers.AsSpan().Count('a');
            }
            return count;
        }
    }

Method

Runtime

Mean

Ratio

Count

.NET 8.0

133.25 us

1.00

Count

.NET 9.0

74.30 us

0.56

New span-related functionality also shows up in .NET 9. String splitting is an operation that’s used all over the place; a search for “.Split(” in C# code on GitHub yields millions of hits, and data from a variety of sources suggests that just the simplest overload `Split(params char[]? separator)` is used by upwards of 90% of applications and 20% of nuget packages. So it should come as no surprise that a request to have this functionality for spans is very popular.

![Upvotes for span splitting](https://devblogs.microsoft.com/dotnet/wp-content/uploads/sites/10/2024/09/SpanSplitUpvotes.png)

The devil is in the details, of course, and it’s taken a long time to figure out exactly how it should be exposed. There are largely two different use cases for splitting we see in the wild. One case is where the content being split has an expected or max number of segments, and splitting is used to extract them. For example, `FileVersionInfo` needs to be able to take a version string and parse from it up to 4 components separated by periods. .NET 8 introduced new `Split` extension methods on `MemoryExtensions` to address this use case, by having `Split` take a destination `Span<Range>` to write the bounds of each segment into. That, however, still leaves the second major category of usage, which is for iterating through an unbounded number of segments. A representative example there is this snippet from `HttpListener`‘s web sockets implementation:

    string[] requestProtocols = clientSecWebSocketProtocol.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
    for (int i = 0; i < requestProtocols.Length; i++)
    {
        if (string.Equals(acceptProtocol, requestProtocols[i], StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }
    }

The `clientSecWebSocketProtocol` string is composed of comma-separated values, and this is iterating through them to see if any is equal to the target `acceptProtocol`. It’s doing that, though, with a relatively expensive operation. That `Split` call needs to allocate the `string[]` that’s returned and that holds all the constituent strings, and then each segment results in a `string` being allocated. We can do better, and [dotnet/runtime#104534](https://github.com/dotnet/runtime/pull/104534) from [@bbartels](https://github.com/bbartels) enables that. It adds four new overloads of `MemoryExtensions.Split` and `MemoryExtensions.SplitAny`:

    public static SpanSplitEnumerator<T> Split<T>(this ReadOnlySpan<T> source, T separator) where T : IEquatable<T>;
    public static SpanSplitEnumerator<T> Split<T>(this ReadOnlySpan<T> source, ReadOnlySpan<T> separator) where T : IEquatable<T>;
    public static SpanSplitEnumerator<T> SplitAny<T>(this ReadOnlySpan<T> source, params ReadOnlySpan<T> separators) where T : IEquatable<T>;
    public static SpanSplitEnumerator<T> SplitAny<T>(this ReadOnlySpan<T> source, SearchValues<T> separators) where T : IEquatable<T>;

With that, this same operation can be written as:

    foreach (Range r in clientSecWebSocketProtocol.AsSpan().Split(','))
    {
        if (clientSecWebSocketProtocol.AsSpan(r).Trim().Equals(acceptProtocol, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }
    }

In doing so, it becomes allocation-free, as this `Split` doesn’t need to allocate a `string[]` to hold results and doesn’t need to allocate a `string` for each segment: instead, it’s returning a `ref struct` enumerator that yields a `Range` representing each segment. The caller can then use that `Range` to slice the input. It’s yielding a `Range` rather than, say, a `ReadOnlySpan<T>`, to enable the splitting to be used with original sources other than spans and be able to get the segments in the original form. For example, if I had a `ReadOnlyMemory<T>` and wanted to add segments from it into a list, I could do:

    ReadOnlyMemory<T> source = ...;
    List<ReadOnlyMemory<T>> list = ...;
    foreach (Range r in source.Split(separator))
    {
        list.Add(source.Slice(r));
    }

whereas that wouldn’t be possible if `Split` forced all yielded results to be spans.

You might notice that there’s no `StringSplitOptions` on these overloads. That’s because it’s both not applicable and not necessary. It’s not applicable because we’re working here with `T`, which might be something other than `char`, but an option like `StringSplitOptions.TrimEntries` implies a notion of whitespace, and that’s only relevant for text. And it’s not necessary, because the main benefit of `StringSplitOptions`, both `TrimEntries` and `RemoveEmptyEntries`, is reducing allocation overheads. If these options didn’t exist with the `string` overloads, and you wanted to simulate them with our original example (and spans didn’t exist), it would end up looking like this:

    string[] requestProtocols = clientSecWebSocketProtocol.Split(',');
    for (int i = 0; i < requestProtocols.Length; i++)
    {
        if (string.Equals(acceptProtocol, requestProtocols[i].Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }
    }

There are several possible performance problems here. Imagine the `clientSecWebSocketProtocol` input was `"a , b, , , , , , c"`. There are only three entries we care about here (`"a"`, `"b"`, and `"c"`), but the returned array is going to be a `string[8]` instead of a `string[3]`, because it’s going to have entries for each of those whitespace-only segments. That’s a larger allocation than is necessary. Then, we’ll be producing `string`s for all eight of those segments, even though only three of the `string`s were necessary. And, all of `"a "`, `" b"`, and `" c"` have some extraneous whitespace that needs to be trimmed, such that the following `Trim()` call will allocate a new string for each. The `StringSplitOptions` enables the implementation of `Split` to avoid all of that overhead, by only allocating what’s desired. But with the span version, none of that allocation exists anyway. The consuming loop can trim the spans itself without incurring more overhead than would the `Split` implementation, and the consuming loop can choose to ignore empty entries without increasing the size of a `string[]` allocation.

The net result is such operations can be significantly more efficient while not sacrificing much if anything in the way of maintainability.

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private string _input = "a , b, , , , , , c";
        private string _target = "d";
    
        [Benchmark(Baseline = true)]
        public bool ContainsString()
        {
            foreach (string item in _input.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (item.Equals(_target, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
    
            return false;
        }
    
        [Benchmark]
        public bool ContainsSpan()
        {
            foreach (Range r in _input.AsSpan().Split(','))
            {
                if (_input.AsSpan(r).Trim().Equals(_target, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
    
            return false;
        }
    }

Method

Mean

Ratio

Allocated

Alloc Ratio

ContainsString

127.26 ns

1.00

208 B

1.00

ContainsSpan

61.89 ns

0.49

–

0.00

The nature of this new set of splitting APIs is that they find just the next separator / segment; that’s both practical and possibly a performance improvement by itself. It’s practical because we’re only yielding a single segment at a time, and we don’t have anywhere to store all possible found separator positions (nor do we want to allocate space to do so). And it’s desirable because the consumer may early-exit from the consuming loop, in which case we don’t want to have spent time unnecessarily searching for additional segments that are going to be ignored. The existing set of splitting APIs, however, hand back all found segments in one go, either via a returned `string[]` or via ranges being written to a destination span. And as such, it makes more sense for those overloads to find all separators at once because that operation can be vectorized. In fact, previous versions have done so. But, that vectorization has only benefited from 128-bit vectors. With [dotnet/runtime#93043](https://github.com/dotnet/runtime/pull/93043) from [@khushal1996](https://github.com/khushal1996) in .NET 9, that vectorization will now light-up with 512-bit or 256-bit vectors if they’re available, enabling that separator searching that happens as part of splitting to run up to four times faster.

Spans show up in other new methods as well. [dotnet/runtime#93938](https://github.com/dotnet/runtime/pull/93938) from [@TheMaximum](https://github.com/TheMaximum) added new overloads of `StringBuilder.Replace` that accept `ReadOnlySpan<char>` instead of `string`. As is the case with most such overloads, they share the same implementation, with the `string`\-based overloads just creating a span from the `string` and using a span-based implementation. In practice, the majority of use of `StringBuilder.Replace` uses constant strings as arguments, for example to escape some known delimiter (`Replace("$", "\\$")`), or use previously-created `string` instances, such as to remove some substring from text (`Replace(substring, "")`). But, there are a minority of cases where `Replace` is used with something that’s created on the spot, and for that, these new overloads can help to avoid allocation for creating the arguments. For example, here’s some escaping code used today by MSBuild:

    char[] charsToEscape = ...;
    StringBuilder escapedString = ...;
    foreach (char unescapedChar in charsToEscape)
    {
        string escapedCharacterCode = string.Format(CultureInfo.InvariantCulture, "%{0:x00}", (int)unescapedChar);
        escapedString.Replace(unescapedChar.ToString(CultureInfo.InvariantCulture), escapedCharacterCode);
    }

This is having to perform two `string` allocations to create the input to this `Replace`, which is going to be invoked for each `char` in `charsToEscape`. If `charsToEscape` is something fixed, it could be better to avoid these formatting operations per iteration, and instead just cache the necessary strings for all uses, e.g.

    private static readonly char[] charsToEscape = ...;
    private static readonly string[] escapedCharsToEscape = charsToEscape.Select(c => $"%{(uint)unescapedChar:x00}").ToArray();
    private static readonly string[] stringsToEscape = charsToEscape.Select(c => c.ToString()).ToArray();
    ...
    for (int i = 0; i < charsToEscape.Length; i++)
    {
        escapedString.Replace(stringsToEscape[i], escapedCharsToEscape[i]);
    }

but if `charsToEscape` isn’t predictable, then we can at least avoid the allocation by employing the new overloads, e.g.

    char[] charsToEscape = ...;
    StringBuilder escapedString = ...;
    Span<char> escapedSpan = stackalloc char[5];
    foreach (char unescapedChar in charsToEscape)
    {
        escapedSpan.TryWrite($"%{(uint)unescapedChar:x00}", out int charsWritten);
        escapedString.Replace(new ReadOnlySpan<char>(in unescapedChar), escapedSpan.Slice(0, charsWritten));
    }

and, boom, no more allocation for the arguments.

A variety of other improvements were made to `string` manipulation, mainly around better employing vectorization. `StringComparison.OrdinalIgnoreCase` operations were previously vectorized, but only with 128-bit vectors, which means handling up to 8 `char`s at a time. Thanks to [dotnet/runtime#93116](https://github.com/dotnet/runtime/pull/93116), those code paths have been updated to support 256-bit and 512-bit vectors, which means handling up to 16 or 32 `char`s at a time on hardware accelerated to support it.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private static string s_s1 = """
            Let me not to the marriage of true minds
            Admit impediments; love is not love
            Which alters when it alteration finds,
            Or bends with the remover to remove.
            O no, it is an ever-fixed mark
            That looks on tempests and is never shaken;
            It is the star to every wand'ring bark
            Whose worth's unknown, although his height be taken.
            Love's not time's fool, though rosy lips and cheeks
            Within his bending sickle's compass come.
            Love alters not with his brief hours and weeks,
            But bears it out even to the edge of doom:
            If this be error and upon me proved,
            I never writ, nor no man ever loved.
            """;
        private static string s_s2 = s_s1[0..^1] + "!";
    
        [Benchmark]
        public bool EqualsIgnoreCase() => s_s1.Equals(s_s2, StringComparison.OrdinalIgnoreCase);
    }

Method

Runtime

Mean

Ratio

EqualsIgnoreCase

.NET 8.0

86.79 ns

1.00

EqualsIgnoreCase

.NET 9.0

20.97 ns

0.24

`EndsWith` also gets better, for both strings and spans. Previous releases saw `StartsWith` become a JIT intrinsic, enabling the JIT to generate dedicated SIMD code for `StartsWith` in the case where it’s passed a constant. Now with [dotnet/runtime#98593](https://github.com/dotnet/runtime/pull/98593), the same thing is done for `EndsWith`.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [DisassemblyDiagnoser(maxDepth: 0)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        [Arguments("helloworld.txt")]
        public bool EndsWith(string path) => path.EndsWith(".txt", StringComparison.OrdinalIgnoreCase);
    }

Method

Runtime

path

Mean

Ratio

Code Size

EndsWith

.NET 8.0

helloworld.txt

3.5006 ns

1.00

26 B

EndsWith

.NET 9.0

helloworld.txt

0.6653 ns

0.19

61 B

More interesting to me than these nice gains is the code that was generated to achieve them. This is what the assembly for this benchmark looked like with .NET 8:

    ; Tests.EndsWith(System.String)
           mov       rdi,rsi
           mov       rsi,7EE3C2D25E38
           mov       edx,5
           cmp       [rdi],edi
           jmp       qword ptr [7F24678663A0]; System.String.EndsWith(System.String, System.StringComparison)
    ; Total bytes of code 26

Pretty straightforward, a bit of argument manipulation and then jumping to the actual `string.EndsWith` implementation. Now here’s .NET 9:

    ; Tests.EndsWith(System.String)
           push      rbp
           mov       rbp,rsp
           mov       eax,[rsi+8]
           cmp       eax,4
           jge       short M00_L00
           xor       ecx,ecx
           jmp       short M00_L01
    M00_L00:
           mov       ecx,eax
           lea       rax,[rsi+rcx*2-8]
           mov       rcx,20002000200000
           or        rcx,[rax+0C]
           mov       rax,7400780074002E
           cmp       rcx,rax
           sete      cl
           movzx     ecx,cl
    M00_L01:
           movzx     eax,cl
           pop       rbp
           ret
    ; Total bytes of code 61

Notice there’s no call to `string.EndsWith` in sight. That’s because the JIT has implemented the `EndsWith` functionality here, specific to `".txt"` and `OrdinalIgnoreCase`, in just a few instructions. The address of the string is being passed into this method in the `rsi` register, and the second `mov` instruction is grabbing its `Length` (which is stored 8 bytes from the start of the string object) and storing that into the `eax` register. It’s then checking whether the string is at least 4 characters long; if it’s not, it can’t possibly end with `".txt"` and thus it jumps to the end to return `false`. If it was at least 4 characters long, it then proceeds to load the last four characters of the string as a 64-bit value into `rcx` and OR it with the value `20002000200000`. Why? It’s playing the same ASCII trick we’ve seen before. The `'.'` is not subject to casing, so we don’t need to manipulate its value, and hence the 16-bits that aligns with the `'.'` are 0. But the other three characters all need to be comparable with both their lower-case and upper-case forms, so this is OR’ing each of the three 16-bit characters with `0x2000` to produce the lower-case form. At that point, the 64-bit value can be compared against the 64-bit representation of `".txt"`, which is `7400780074002E` (the ASCII value for `'.'` is 0x2E, for `'t'` is 0x74, and for `'x'` is 0x78). Then it’s just a simple matter of whether that compared equally or not.

Finally, we’ve not talked much about arrays separate from spans, but there have been improvements there as well. [dotnet/runtime#102739](https://github.com/dotnet/runtime/pull/102739) and [dotnet/runtime#104103](https://github.com/dotnet/runtime/pull/104103) move more logic for array handling from native code in the runtime up into C# code in `CoreLib`. For example, `Array.Copy` has to handle a wide array of cases (pun intended), some of which can be implemented very efficiently and some of which are more laborious, and it tries to optimize the “simple” cases, such as whether the bits from one array can simply be memcpy’d over to the other, with as little overhead as possible. Some of those cases are easy to determine, such as single-dimensional arrays having the exact same type, but other cases require more introspection, such as if one array is enums and the other array is of the underlying type of that enum. The checks to make those determinations previously lived in native code in the runtime, but as of this PR they’re now implemented in C#, and in doing so, some of the overhead associated with the checks has been removed.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private DayOfWeek[] _enums = Enum.GetValues<DayOfWeek>();
        private int[] _ints = new int[7];
    
        [Benchmark]
        public void Copy() => Array.Copy(_enums, _ints, _enums.Length);
    }

Method

Runtime

Mean

Ratio

Copy

.NET 8.0

16.25 ns

1.00

Copy

.NET 9.0

11.05 ns

0.68

In addition to other benefits that come from moving such logic into managed code (better maintainability, more implicitly safe code, reduced overhead from transitioning between managed and native, etc.), there’s another less obvious benefit: impact on GC pause times. And that’s nowhere more obvious than with [dotnet/runtime#98623](https://github.com/dotnet/runtime/pull/98623), which moved the implementations of `memset`/`memcpy` helpers used for core operations like `Span<T>.Fill` and `Array.Copy` from native to managed. Consider this C# console app:

    using System.Diagnostics;
    
    new Thread(() =>
    {
        var a = new object[1000];
        while (true) a.AsSpan().Fill(a);
    })
    { IsBackground = true }.Start();
    
    var sw = new Stopwatch();
    while (true)
    {
        sw.Restart();
        for (int i = 0; i < 10; i++)
        {
            GC.Collect();
            Thread.Sleep(15);
        }
        Console.WriteLine(sw.Elapsed.TotalSeconds);
    }

This is sitting in a loop that simply times how long it takes to perform 10 gen2 collections, each spaced out by ~15 ms. If each collection were free then, this loop should take ~150 ms. Since it’s not free, let’s round up and estimate that the loop should be around ~200 ms. Before we run the loop, though, we launch a thread that just sits in an infinite loop filling a span. That shouldn’t mess with our timing loop… or should it? When I run this on .NET 8, I get values like this:

    1.0683524
    0.8884759
    0.8420748
    1.1101804
    1.2730635

Those values are in seconds, and that’s approximately 5x larger than we’d predicated. Now I try on .NET 9, and I get results like this:

    0.1638237
    0.2129748
    0.2859566
    0.3020449
    0.2871952

What happened? In order to do some of its work, the GC needs to be able to get a consistent view of the world, which is violated if things are concurrently changing out from under it. As such, it may need to temporarily suspend all threads in the process, but to do that, it needs to wait for each thread to get to a safe point, and if a thread is executing code in the runtime, that can be hard to do. In this particular case, there’s a thread spending almost all of its time sitting in a call to `Span<T>.Fill`, aka `memset`, which was implemented in .NET 8 as a native function in the runtime; this couldn’t be interrupted, and the GC would need to wait until the call returned and it could catch it before it could interrupt that thread. In .NET 9, these implementations are all in managed code, and the GC can trivially get the threads to a safe point.

Collections
-----------

### LINQ

Language Integrated Query, or LINQ, is a mainstay of .NET. At its heart, LINQ is a specification for hundreds of overloads of methods that manipulate data, and then implementations of that specification for different types. One of the most prominent implementations comes from `System.Linq.Enumerable`, sometimes referred to as “LINQ to Objects,” which provides an implementation of these operations as methods for working with `IEnumerable<T>`. It’s an incredibly useful set of operations, used ubiquitously, and thus it’s a common target for performance optimization. In many .NET releases, it’ll get a new additional method here or an optimized method there, a trickle of focused improvements. But in .NET 9, it’s received a huge amount of attention, with some improvements localized to particular methods and others broadly applicable across much of the surface area.

One of the more sweeping LINQ changes in .NET 9 has to do with how various optimizations are implemented. In the original implementation of LINQ circa 2007, almost every method was logically independent from every other. A method like `SelectMany` took in an `IEnumerable<TSource>` and didn’t know anything about where that input came from; every enumerable was processed the same as every other. Some methods would special-case more optimizable data types, though, for example `ToArray` would check whether the incoming `IEnumerable<TSource>` implemented `ICollection<TSource>`, preferring if it did to use the collection’s `Count` and `CopyTo` in order to avoid having to `MoveNext`/`Current` through the whole input. But a couple of methods, in particular some overloads of `Select` and `Where`, did something more interesting. Much of LINQ was implemented using the C# compiler’s support for iterators, where a method that returns `IEnumerable<T>` can use `yield return t;` to produce instances of `T`, and the compiler handles rewriting that method into a class that implements `IEnumerable<T>` and handles all the gnarly state-machine details for you. These few `Select` and `Where` overloads, however, didn’t use iterators, with the developer that authored them instead preferring to write a custom enumerable by hand. Why? It’s possible to hand-author an ever-so-slightly more efficient implementation in some cases, but the compiler is actually really good at doing it well, so that’s not the reason. The reason is because it a) gives the type a name that can be referred to elsewhere in the code, and b) it allows that type to expose state that other code can interrogate. This enables information to flow from one query operator to the next. So, for example, `Where` could return a `WhereEnumerableIterator` instance:

    class WhereEnumerableIterator<TSource> : Iterator<TSource>
    {
        IEnumerable<TSource> source;
        Func<TSource, bool> predicate;
        ...
    }

And then `Select` can look for that type, or, rather, its base type, `Iterator<TSource>`:

    public static IEnumerable<TResult> Select<TSource, TResult>(this IEnumerable<TSource> source, Func<TSource, TResult> selector) {
        if (source == null) throw Error.ArgumentNull("source");
        if (selector == null) throw Error.ArgumentNull("selector");
        if (source is Iterator<TSource>) return ((Iterator<TSource>)source).Select(selector);
        ...
    }

and that `WhereEnumerableIterator<TSource>` can override that virtual `Select` method on `Iterator<TSource>` to specialize what happens when a `Where` is followed by `Select`:

    public override IEnumerable<TResult> Select<TResult>(Func<TSource, TResult> selector) {
        return new WhereSelectEnumerableIterator<TSource, TResult>(source, predicate, selector);
    }

This is useful because it allows for avoiding one of the major sources of overhead with enumerables. Without this optimization, if I had `source.Where(x => true).Select(x => x)`, the resulting enumerable would be for the `Select`, which would in turn wrap the enumerable for the `Where`, which would in turn wrap the `source` enumerable. That means that when I call `MoveNext` on the select iterator, it in turn needs to call `MoveNext` on the `Where`, which will in turn call `MoveNext` on the source, and then the same for `Current`. That means for each element in the source, we end up making 6 interface calls. With the cited optimization, we no longer have separate iterators for the `Select` and `Where`. Those end up being combined into a single iterator that does the work of both, eliminating one level from the call chain, so instead of 6 interface calls per element, there’s only 4. (See [Deep Dive on LINQ](https://www.youtube.com/watch?v=xKr96nIyCFM) and [An event DEEPER Dive into LINQ](https://www.youtube.com/watch?v=W4-NVVNwCWs) for a more in-depth exploration of how exactly this works.)

Over the last decade with .NET, those optimizations have been significantly extended, and in some cases to much greater benefit than just saving a few interface calls. For example, in a previous .NET release, a similar mechanism was used to special-case `OrderBy` followed by `First`. Without special-casing, the `OrderBy` would need to do both a full copy of the input source and an `O(N log N)` sort of the data, all as part of the first call to `MoveNext` from `First`. But with the optimization, `First` is able to see that its source is that `OrderBy`, in which case it doesn’t need a copy or sort at all, and can instead simply do an `O(N)` search of `OrderBy`‘s source for its minimum value. That difference can yield monstrous wins.

This additional special-casing was achieved with internal interfaces in the library. An `IIListProvider<TElement>` provided `ToArray`, `ToList`, and `GetCount` methods, and an `IPartition<TElement>` interface (which inherited `IIListProvider<TElement>`) provided additional methods like `Skip`, `Take`, and `TryGetFirst`. Custom iterators used to back various LINQ methods could then also implement one or more of these interfaces to specialize being followed by a call like `ToArray` or `Count()`. For example, it’s very common (e.g. as part of “paging”) to see call sequences like `.Skip(...).Take(...)`; with these optimizations, those two operations can be consolidated down into a single iterator, and if it were followed by an operation like `Last()` or `ToList()`, those could see through both operators to the source in order to possibly optimize based on it (e.g. if the source were an array, `Last()` could calculate the exact element to return without needing to do any iteration at all).

[dotnet/runtime#98969](https://github.com/dotnet/runtime/pull/98969) and [dotnet/runtime#99344](https://github.com/dotnet/runtime/pull/99344) remove those internal interfaces and consolidate all of their members down to the base `Iterator<TSource>` type. This has a variety of benefits. Not directly related to performance, it simplifies the code base, making it easier to maintain (and easier to maintain code is also generally easier to optimize); the interface members of `IPartition<TElement>` became `virtual` methods on the base class, which also resulted in some code reduction due to being able to share the same default implementation (though with the introduction of default interface methods a few releases ago, this _could_ have been done separately without this consolidation). On the performance front, though, there are three main benefits of this PR:

1.  Virtual dispatch is generally a bit cheaper than interface dispatch. All of those interface methods became virtual methods, enabling all call sites to them to be a bit cheaper.
2.  In various places, type tests were being done for multiple targets, and those could now be consolidated to reduce type checks. For example, `Select` looked something like this:
    
        if (source is Iterator<TSource> iterator)
        {
            ...
        }
        
        if (source is IPartition partition)
        {
            ...
        }
    
    That means for non-specialized iterators, `Select` was incurring a type check for `Iterator<TSource>` and an interface check for `IPartition<TSource>`. With this change, the latter check is now removed.
    
3.  Some types were only inheriting from the base class but not implementing any of the interfaces, some were implementing an interface but not the other, some were even implementing one of the interfaces but not deriving from the base class. The new approach makes it such that all of the provided virtual methods are implemented by any iterator deriving from the base class.

[dotnet/runtime#97905](https://github.com/dotnet/runtime/pull/97905), [dotnet/runtime#97956](https://github.com/dotnet/runtime/pull/97956), [dotnet/runtime#98874](https://github.com/dotnet/runtime/pull/98874), and [dotnet/runtime#99216](https://github.com/dotnet/runtime/pull/99216) also added more implementations.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private IEnumerable<int> _arrayDistinct = Enumerable.Range(0, 1000).ToArray().Distinct();
        private IEnumerable<int> _appendSelect = Enumerable.Range(0, 1000).ToArray().Append(42).Select(i => i * 2);
        private IEnumerable<int> _rangeReverse = Enumerable.Range(0, 1000).Reverse();
        private IEnumerable<int> _listDefaultIfEmptySelect = Enumerable.Range(0, 1000).ToList().DefaultIfEmpty().Select(i => i * 2);
        private IEnumerable<int> _listSkipTake = Enumerable.Range(0, 1000).ToList().Skip(500).Take(100);
        private IEnumerable<int> _rangeUnion = Enumerable.Range(0, 1000).Union(Enumerable.Range(500, 1000));
    
        [Benchmark] public int DistinctFirst() => _arrayDistinct.First();
        [Benchmark] public int AppendSelectLast() => _appendSelect.Last();
        [Benchmark] public int RangeReverseCount() => _rangeReverse.Count();
        [Benchmark] public int DefaultIfEmptySelectElementAt() => _listDefaultIfEmptySelect.ElementAt(999);
        [Benchmark] public int ListSkipTakeElementAt() => _listSkipTake.ElementAt(99);
        [Benchmark] public int RangeUnionFirst() => _rangeUnion.First();
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

DistinctFirst

.NET 8.0

49.844 ns

1.00

328 B

1.00

DistinctFirst

.NET 9.0

7.928 ns

0.16

–

0.00

AppendSelectLast

.NET 8.0

3,668.347 ns

1.000

144 B

1.00

AppendSelectLast

.NET 9.0

2.222 ns

0.001

–

0.00

RangeReverseCount

.NET 8.0

8.703 ns

1.00

–

NA

RangeReverseCount

.NET 9.0

3.465 ns

0.40

–

NA

DefaultIfEmptySelectElementAt

.NET 8.0

2,772.283 ns

1.000

144 B

1.00

DefaultIfEmptySelectElementAt

.NET 9.0

4.399 ns

0.002

–

0.00

ListSkipTakeElementAt

.NET 8.0

3.699 ns

1.00

–

NA

ListSkipTakeElementAt

.NET 9.0

2.103 ns

0.57

–

NA

RangeUnionFirst

.NET 8.0

53.670 ns

1.00

344 B

1.00

RangeUnionFirst

.NET 9.0

5.181 ns

0.10

–

0.00

Subsequent PRs also further benefited from this consolidation. [dotnet/runtime#99218](https://github.com/dotnet/runtime/pull/99218), for example, uses it to improve `Enumerable.Any(IEnumerable<T>)`. `Any` just needs to say whether the source has any elements, and it tries hard to determine that without having to get an enumerator from the source, which allocates, and call `MoveNext` (an interface call) to see if it returns true. In .NET 8, it was doing this using `Enumerable.TryGetNonEnumeratedCount`, which uses `Iterator<T>.GetCount(onlyIfCheap: true)` (the “onlyIfCheap” part basically means “don’t enumerate to compute the count”). However, for iterators where it’s not “cheap”, `TryGetNonEnumeratedCount` would return `false`, and `Any` would still be forced to get an enumerator. However, now that every `Iterator<T>` provides a `TryGetFirst`, `Any` can use that in the case where the source is an `Iterator<T>` but `GetCount` isn’t successful. Worst case, `TryGetFirst` will itself end up calling `GetEnumerator`, but best case, the iterator will have provided a more efficient implementation of `TryGetFirst`. And either way, it’s still a win, because enumerating would require not only a `GetEnumerator` call on the `Iterator<T>`, but that in turn would need to call `GetEnumerator<T>` on whatever source it was wrapping, whereas this ends up saving one layer.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private IEnumerable<int> _data1 = Iterations(100).Where(i => i % 2 == 0).Select(i => i);
        private IEnumerable<int> _data2 = Enumerable.Range(0, 100).ToArray().Where(i => i % 2 == 0).Select(i => i);
    
        [Benchmark] public bool Any1() => _data1.Any();
        [Benchmark] public bool Any2() => _data2.Any();
    
        private static IEnumerable<int> Iterations(int count)
        {
            for (int i = 0; i < count; i++) yield return i;
        }
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

Any1

.NET 8.0

31.967 ns

1.00

104 B

1.00

Any1

.NET 9.0

15.818 ns

0.49

40 B

0.38

Any2

.NET 8.0

21.062 ns

1.00

56 B

1.00

Any2

.NET 9.0

3.780 ns

0.18

–

0.00

Another cross-cutting improvement across LINQ comes in [dotnet/runtime#96602](https://github.com/dotnet/runtime/pull/96602) and has to do with empty inputs. It’s also a nice example of how what’s considered an optimization ebbs and flows. In the beginning of LINQ, `Enumerable.Empty<T>()`, which is strongly-typed to return `IEnumerable<T>`, returned an empty `T[]` as the actual instance. When `Array.Empty<T>()` was introduced, it used that. Then, however, the aforementioned `IPartition<T>` was introduced internally in LINQ, and `Enumerable.Empty<T>()` was changed to return a singleton `EmptyPartition<T>`, an implementation of the interface with all of the methods dedicated to being efficient for empty inputs. This was helpful internally as an implementation detail, as methods that were typed to return `IPartition<T>` could return that `EmptyPartition<T>` instance, whereas they couldn’t return a `T[]`, since it doesn’t implement that interface. However, it had a downside. A variety of APIs can optimize very well if they know the input is empty, e.g. a `Take` call can immediately return an empty singleton if it knows the input is empty. But, it can’t be based solely on whether it’s empty _now_, but rather if it’s empty now and for always; otherwise, you could call `Take`, it would see it was empty, then elements get added to the source, and then you call `GetEnumerator` on the enumerable returned from `Take`… according to the rules for how all of this behaves, that should yield the newly-added elements, but if `Take` had returned an empty singleton, it wouldn’t. There are a variety of types that we know will always be empty once seen as empty (e.g. `ImmutableArray<T>`, `T[]`, `FrozenSet<T>`, etc.), but it’d be too costly to check for each of them individually. Instead, the implementation just picked the same type as `Enumerable.Empty<T>()` returned as the one to check for. That’s fairly reasonable, but as it turns out, when that type is `EmptyPartition<T>`, there are a lot of empty arrays that are no longer noticed as being a special empty input. This gets even worse with collection expressions in the picture, as initializing an `IEnumerable<T>` with `[]` will, as an implementation detail, produce `Array.Empty<T>()`. So, this PR put everything back on a plan of `Enumerable.Empty<T>()` being `Array.Empty<T>()` and a `T[0]` being what’s checked for when special-casing empty inputs. The PR also included new checks for empty in many different places that warranted it.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private string[] _values = [];
    
        [Benchmark] public object Chunk() => _values.Chunk(10);
        [Benchmark] public object Distinct() => _values.Distinct();
        [Benchmark] public object GroupJoin() => _values.GroupJoin(_values, i => i, i => i, (i, j) => i);
        [Benchmark] public object Join() => _values.Join(_values, i => i, i => i, (i, j) => i);
        [Benchmark] public object ToLookup() => _values.ToLookup(i => i);
        [Benchmark] public object Reverse() => _values.Reverse();
        [Benchmark] public object SelectIndex() => _values.Select((s, i) => i);
        [Benchmark] public object SelectMany() => _values.SelectMany(i => i);
        [Benchmark] public object SkipWhile() => _values.SkipWhile(i => true);
        [Benchmark] public object TakeWhile() => _values.TakeWhile(i => true);
        [Benchmark] public object WhereIndex() => _values.Where((s, i) => true);
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

Chunk

.NET 8.0

10.7213 ns

1.00

72 B

1.00

Chunk

.NET 9.0

4.1320 ns

0.39

–

0.00

Distinct

.NET 8.0

9.4410 ns

1.00

64 B

1.00

Distinct

.NET 9.0

0.7162 ns

0.08

–

0.00

GroupJoin

.NET 8.0

22.4746 ns

1.00

144 B

1.00

GroupJoin

.NET 9.0

1.1356 ns

0.05

–

0.00

Join

.NET 8.0

18.6332 ns

1.00

168 B

1.00

Join

.NET 9.0

1.3585 ns

0.07

–

0.00

ToLookup

.NET 8.0

23.3518 ns

1.00

128 B

1.00

ToLookup

.NET 9.0

0.9539 ns

0.04

–

0.00

Reverse

.NET 8.0

9.5791 ns

1.00

48 B

1.00

Reverse

.NET 9.0

0.9947 ns

0.10

–

0.00

SelectIndex

.NET 8.0

11.1235 ns

1.00

72 B

1.00

SelectIndex

.NET 9.0

0.5603 ns

0.05

–

0.00

SelectMany

.NET 8.0

10.7537 ns

1.00

64 B

1.00

SelectMany

.NET 9.0

0.9906 ns

0.09

–

0.00

SkipWhile

.NET 8.0

11.2900 ns

1.00

72 B

1.00

SkipWhile

.NET 9.0

1.0988 ns

0.10

–

0.00

TakeWhile

.NET 8.0

11.8818 ns

1.00

72 B

1.00

TakeWhile

.NET 9.0

1.0381 ns

0.09

–

0.00

WhereIndex

.NET 8.0

11.1751 ns

1.00

80 B

1.00

WhereIndex

.NET 9.0

1.2185 ns

0.11

–

0.00

[dotnet/runtime#98963](https://github.com/dotnet/runtime/pull/98963) also has to do with emptiness, but actually improves non-empty cases. `DefaultIfEmpty` needs to produce an `IEnumerable<T>` containing all of the elements from the source, or if the source is empty, an enumerable with a single `default(T)` value. In most cases, that means it has to allocate a new enumerable, because for the same reasons as just described, it can’t know until `GetEnumerator` is called whether the source is empty. Except, it can if the source is a `T[]`, which has an immutable length. This PR thus special-cases arrays, which are very common, such that if the array isn’t empty, it’s just returned directly rather than allocating a wrapper enumerable for it. That’s more than just about avoiding an allocation: that wrapper object would be in the middle of all subsequent iterations of the object, so avoiding it not only avoids an allocation but also a layer of interface calls. And for subsequent code paths that special-case arrays, the result of `DefaultIfEmpty` will still be seen as an `T[]` and thus now special-cased, whereas it wouldn’t if it were wrapped.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private int[] _data = Enumerable.Range(0, 1000).ToArray();
    
        [Benchmark]
        public double Average() => _data.DefaultIfEmpty().Average();
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

Average

.NET 8.0

1,915.4 ns

1.00

80 B

1.00

Average

.NET 9.0

117.6 ns

0.06

–

0.00

Another change taking advantage of emptiness is [dotnet/runtime#99256](https://github.com/dotnet/runtime/pull/99256), this time for `Enumerable.Chunk`. `Chunk(int size)` creates an `IEnumerable<T[]>` that pages through the input `size` elements at a time. Normally, this requires iterating through the source and buffering until `size` elements have been reached, then yielding an array with those elements, and then rinsing and repeating. With an array input, we could do this much more efficiently, as we could just do math to compute the right bounds for each set to be yielded and do an efficient copy of the elements, rather than iterating through each element one by one. And while it might not be worth adding a specialized check for array here (`Chunk` isn’t exactly a high-performance method to begin with, given it’s allocating a new array for each set), as it turns out we now have a check for array, as part of determining whether the source is permanently empty. This PR just leverages that check to take advantage of both answers. If the array is empty, then it still just returns an empty array. But if it’s not empty, rather than falling back to the normal iteration path, it employs a 7-line alternative that’s specialized to arrays and much more efficient.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private int[] _values = Enumerable.Range(0, 1000).ToArray();
    
        [Benchmark]
        public int Count()
        {
            int count = 0;
            foreach (var chunk in _values.Chunk(10)) count += chunk.Length;
            return count;
        }
    }

Method

Runtime

Mean

Ratio

Count

.NET 8.0

3.612 us

1.00

Count

.NET 9.0

1.334 us

0.37

The statement about checking for empty now and permanently applies in particular to methods that accept and return enumerables. It’s the laziness of these methods that makes that relevant. There is, however, a set of LINQ methods that are not lazy because they produce things that aren’t enumerables, such as `ToArray` returning an array, `Sum` returning a single value, `Count` returning an `int`, and so on. These methods also received attention, thanks to [dotnet/runtime#102884](https://github.com/dotnet/runtime/pull/102884) from [@neon-sunset](https://github.com/neon-sunset). One of the optimizations applied in various LINQ methods is to special-case input types that are super common, in particular `T[]` and `List<T>`. These can be special-cased not just as `IList<T>`, which would generally be more efficient than enumerating an input via an `IEnumerator<T>`, but rather as a `ReadOnlySpan<T>`, which can be iterated through very efficiently. This PR extended that optimization to apply to most of these other non-enumerable producing methods, in particular overloads of `Any`, `All`, `Count`, `First`, and `Single` that take predicates. This is particularly helpful because recent additions to analyzers have resulted in developers being told about opportunities to simplify their LINQ usage. [IDE0120](https://learn.microsoft.com/dotnet/fundamentals/code-analysis/style-rules/ide0120) flags code like `source.Where(predicate).First()` and instead recommends simplifying it to `source.First(predicate)`. And while that is a nice simplification and is likely to reduce allocation, `Where` is considerably more optimized than `First(predicate)` has been, with the former having special-casing for `T[]` and `List<T>` but the latter historically not. That difference is now addressed in .NET 9.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private IEnumerable<int> _list = Enumerable.Range(0, 1000).ToList();
    
        [Benchmark] public bool Any() => _list.Any(i => i == 1000);
        [Benchmark] public bool All() => _list.All(i => i >= 0);
        [Benchmark] public int Count() => _list.Count(i => i == 0);
        [Benchmark] public int First() => _list.First(i => i == 999);
        [Benchmark] public int Single() => _list.Single(i => i == 0);
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

Any

.NET 8.0

1,553.3 ns

1.00

40 B

1.00

Any

.NET 9.0

222.2 ns

0.14

–

0.00

All

.NET 8.0

1,586.0 ns

1.00

40 B

1.00

All

.NET 9.0

224.9 ns

0.14

–

0.00

Count

.NET 8.0

1,535.6 ns

1.00

40 B

1.00

Count

.NET 9.0

244.6 ns

0.16

–

0.00

First

.NET 8.0

1,600.7 ns

1.00

40 B

1.00

First

.NET 9.0

245.4 ns

0.15

–

0.00

Single

.NET 8.0

1,550.6 ns

1.00

40 B

1.00

Single

.NET 9.0

239.4 ns

0.15

–

0.00

[dotnet/runtime#97004](https://github.com/dotnet/runtime/pull/97004) from [@neon-sunset](https://github.com/neon-sunset) uses that same mechanism to improve performance for `List<T>` inputs inside of `Enumerable.SequenceEqual`. `Enumerable.SequenceEqual` already had a special-case that checked whether both inputs were arrays, and if they were, it created spans from those arrays and delegated to `MemoryExtensions.SequenceEquals`, which will efficiently iterate through the spans, vectorizing if possible. This PR just tweaked that special-case to use the same helper that’s used elsewhere to try to get a span from the source, and that gives this super power to `List<T>` as well.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private IEnumerable<int> _source1, _source2;
    
        [GlobalSetup]
        public void Setup()
        {
            _source1 = Enumerable.Range(0, 10_000).ToArray();
            _source2 = _source1.ToList();
        }
    
        [Benchmark]
        public bool SequenceEqual() => _source1.SequenceEqual(_source2);
    }

Method

Runtime

Mean

Ratio

SequenceEqual

.NET 8.0

26,623.3 ns

1.00

SequenceEqual

.NET 9.0

913.4 ns

0.03

`ToArray` and `ToList` were generally improved via a variety of PRs, in particular by [dotnet/runtime#96570](https://github.com/dotnet/runtime/pull/96570). `ToArray` in particular is used so ubiquitously that over the years, many folks have attempted to optimize it. In doing so, however, it’s gotten too complex for its own good. This PR takes advantage of newer runtime capabilities to significantly simplify the implementation, while also improving common case performance. The easy cases were already handled well and continue to be: if the source is an `ICollection<T>`, its `Count` / `CopyTo` methods can be used to provide a very efficient `ToArray`, and if the source is an `Iterator<TSource>`, `ToArray` just delegates to the iterator’s `ToArray` implementation. The challenge, instead, is in efficiently handling the case where we’re dealing with an `IEnumerable<T>` of unknown length, needing to handle both short and long inputs, and doing so in a way that minimizes allocation and maximizes throughput. To achieve that, this PR deleted the internal `ArrayBuilder`, `LargeArrayBuilder`, and `SparseArrayBuilder` types that were previously being used and replaced them all with a simpler internal `SegmentedArrayBuilder`. The builder is seeded with an `[InlineArray]`\-based struct that’s large enough to hold eight `T` instances. For up to eight items, the builder can simply use that stack-based space to store the elements. For more than eight items, the builder contains another `[InlineArray]` of up to 27 `T[]`s. The arrays stored in there are rented from the `ArrayPool<T>`, and based on the starting size and standard doubling growth algorithm, 27 arrays is enough to store `Array.MaxLength` elements. This approach means that small inputs never need to allocate (other than for the final `T[]`, which is unavoidable as it’s the whole purpose of the method), and larger inputs can use `ArrayPool<T>` arrays without having to copy while growing, leading to on average significantly less allocation than before and generally faster throughput. There are trade-offs to this approach when compared to the previous one, with a few niche corner cases it doesn’t handle quite as efficiently, but on the whole it’s an improvement in both performance and maintainability.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        [Arguments(1)]
        [Arguments(8)]
        [Arguments(500)]
        public string[] IteratorToArray(int count) => GetItems(count).ToArray();
    
        private IEnumerable<string> GetItems(int count)
        {
            for (int i = 0; i < count; i++)
            {
                yield return ".NET 9";
            }
        }
    }

Method

Runtime

count

Mean

Ratio

Allocated

Alloc Ratio

IteratorToArray

.NET 8.0

1

65.51 ns

1.00

136 B

1.00

IteratorToArray

.NET 9.0

1

41.39 ns

0.63

80 B

0.59

IteratorToArray

.NET 8.0

8

103.30 ns

1.00

192 B

1.00

IteratorToArray

.NET 9.0

8

74.66 ns

0.72

136 B

0.71

IteratorToArray

.NET 8.0

500

3,100.69 ns

1.00

8536 B

1.00

IteratorToArray

.NET 9.0

500

3,080.31 ns

0.99

4072 B

0.48

[dotnet/runtime#104365](https://github.com/dotnet/runtime/pull/104365) from [@andrewjsaid](https://github.com/andrewjsaid) followed-up on this to use that same `SegmentedArrayBuilder` to improve `ToList`. Everything stays the same, except for the last step of constructing the final collection to be returned: rather than allocating an array, it allocates a `List<T>` and uses the `CollectionsMarshal.SetCount` method to set both the `Capacity` and `Count` of the list to the desired size, then copies the elements directly into the backing array for the list, thanks to `CollectionsMarshal.AsSpan`. `ToList` was also improved in [dotnet/runtime#86796](https://github.com/dotnet/runtime/pull/86796) from [@brantburnett](https://github.com/brantburnett). In various `Iterator<T>.ToList` specializations, the common pattern is to use `List<T>.Add` to fill in the resulting collection. This PR used a similar approach as with the previous PR, using a combination of `CollectionsMarshal.SetCount` and `CollectionsMarshal.AsSpan` to get a span for the list and directly write into the span. This saves some of the overhead from `List<T>.Add`, including bounds checks that would otherwise occur when writing to its backing array.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        public List<int> IteratorSelectToList() => GetItems(8).Select(i => i).ToList();
    
        [Benchmark]
        public List<int> IteratorWhereSelectToList() => GetItems(8).Where(i => true).Select(i => i).ToList();
    
        private IEnumerable<int> GetItems(int count)
        {
            for (int i = 0; i < count; i++)
            {
                yield return i;
            }
        }
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

IteratorSelectToList

.NET 8.0

75.14 ns

1.00

224 B

1.00

IteratorSelectToList

.NET 9.0

67.50 ns

0.90

184 B

0.82

IteratorWhereSelectToList

.NET 8.0

94.84 ns

1.00

288 B

1.00

IteratorWhereSelectToList

.NET 9.0

89.42 ns

0.94

248 B

0.86

A few more tweaks were made to `ToList` and `ToArray` in [dotnet/runtime#95224](https://github.com/dotnet/runtime/pull/95224) from [@Windows10CE](https://github.com/Windows10CE) and [dotnet/runtime#100218](https://github.com/dotnet/runtime/pull/100218). The former improved `ToList` on the result of a `Distinct` or `Union` by enabling `HashSet<T>`‘s `CopyTo` implementation to be used; previously a custom function was manually iterating through the set, and this PR deleted that code (yay!) and just used `List<T>`‘s constructor directly. The latter PR also improved `Distinct` and `Union`, but for `ToArray`, and specifically in the case where it would have allocated a 0-length array when the source was empty. [dotnet/runtime#99639](https://github.com/dotnet/runtime/pull/99639) also improved `ToArray` and `ToList` on the result of an `OrderBy`; `OrderBy`‘s iterator already special-cased empty sources, but with small tweaks it could also be made to optimize sources with only a single element, in which case no additional work needs to be done (a length-1 array is inherently sorted).

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        public int[] OrderByToArray() => GetItems(1).OrderBy(x => x).ToArray();
    
        private IEnumerable<int> GetItems(int count)
        {
            for (int i = 0; i < count; i++)
            {
                yield return i;
            }
        }
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

OrderByToArray

.NET 8.0

66.99 ns

1.00

352 B

1.00

OrderByToArray

.NET 9.0

53.92 ns

0.81

160 B

0.45

Not to be left out from the fun its `To` cousins are having, `ToDictionary` also sees improvements from [dotnet/runtime#96574](https://github.com/dotnet/runtime/pull/96574) from [@xin9le](https://github.com/xin9le). The PR changes the code to do a better job setting the capacity of the `Dictionary<TKey, TValue>` prior to filling it, and also using the `CollectionsMarshal.AsSpan` to share code for handling sources that are arrays and lists, while also shaving off some overhead by enumerating the span instead of the list directly.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private readonly IEnumerable<KeyValuePair<int, int>> _enumerable = Enumerable.Range(0, 10_000).Select(x => new KeyValuePair<int, int>(x, x));
    
        [Benchmark]
        public Dictionary<int, KeyValuePair<int, int>> EnumerableToDictionary() => _enumerable.ToDictionary(x => x.Key);
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

EnumerableToDictionary

.NET 8.0

284.3 us

1.00

788.73 KB

1.00

EnumerableToDictionary

.NET 9.0

149.9 us

0.53

237.01 KB

0.30

[dotnet/runtime#96605](https://github.com/dotnet/runtime/pull/96605) updated `Enumerable.Min` and `Enumerable.Max` to specialize for `char`, `Int128`, and `UInt128` (previous changes specialized other numerical primitives, but these had been left out). By taking advantage of the existing code paths for handling those other primitives, with just a few lines added/changed, these types can now utilize those faster paths, which in particular special-case arrays and lists (which means it can then avoid an enumerator allocation in addition to faster access to each element).

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private Int128[] _values = Enumerable.Range(0, 1000).Select(x => (Int128)x).ToArray();
    
        [Benchmark]
        public Int128 Max() => _values.Max();
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

Max

.NET 8.0

1,882.0 ns

1.00

32 B

1.00

Max

.NET 9.0

624.7 ns

0.33

–

0.00

The aforementioned special code paths for the primitive types also support vectorization. Previously that vectorization only supported 128-bit and 256-bit vector widths, but as of [dotnet/runtime#93369](https://github.com/dotnet/runtime/pull/93369) from [@Spacefish](https://github.com/Spacefish), it now also supports 512-bit vector widths, possibly doubling the throughput of `Enumerable.Min` and `Enumerable.Max` on supported hardware with the core numerical primitive types.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private int[] _values = Enumerable.Range(0, 10_000).ToArray();
    
        [Benchmark]
        public int Max() => _values.Max();
    }

Method

Runtime

Mean

Ratio

Max

.NET 8.0

327.6 ns

1.00

Max

.NET 9.0

166.3 ns

0.51

One caveat here about AVX512. Some AVX512 hardware, even on recent chips, can take a measurable amount of time to “power up,” such that it might be tens, hundreds, or even thousands of cycles before AVX512 processing ends up actually dispatching 512-bit vectors. Until then, the hardware might end up doing the equivalent of dispatching two 256-bit vectors. On my machine, for example, if I lower the size in the previous benchmark from 10,000 elements to 1,000 elements, the .NET 9 improvement disappears and it ends up running at exactly the same throughput as on .NET 8; on a colleague’s machine with a different processor, even at 1,000 elements the .NET 9 throughput is almost twice that of .NET 8. This is all to say, your mileage may vary. In some of the micro-benchmarks discussed in this post, small improvements are made to already very fast operations, and the gains then come from those operations being done many, many, many times on hot paths. In others, the gains come from taking an expensive operation and making it measurably cheaper. In general the benefits with using AVX512 in these kinds of vectorized implementations come for the latter case, where large data sizes lead to operations taking significant amounts of time, and the use of 512-bit vectors instead of 256-bit vectors measurably speeds up those longer operations.

The `OrderBy` family of methods on `Enumerable` were also improved in several ways:

*   Ordering operations followed by a `First()` or `Last()` call were already specialized to completely avoid the `O(N log N)` sort and instead do an `O(N)` search for the min or max. However, `OrderBy` in LINQ is fairly complicated because it needs to account for the possibility of one or more subsequent `ThenBy` operations that impact the sort order, and thus it uses a custom comparison mechanism that factors in the possibility of such refinement. That custom comparer mechanism was being used as part of those `First`/`Last` specializations. [dotnet/runtime#97483](https://github.com/dotnet/runtime/pull/97483) detects whether there are any `ThenBy`s in play, and if there aren’t, it bypasses that customization and, in doing so, avoids its overhead. That can be very measurable, but in certain cases, it can be enormous, as it can enable other optimizations to kick in, e.g. an `Order().Last()` on an `int[]` can just end up doing a vectorized search for the max.
    
        // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        using System.Runtime.InteropServices;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [MemoryDiagnoser(false)]
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            private List _ints;
        
            [GlobalSetup]
            public void Setup()
            {
                _ints = new(Enumerable.Range(-8000, 8000 * 2));
                new Random(42).Shuffle(CollectionsMarshal.AsSpan(_ints));
            }
        
            [Benchmark]
            public int OrderByLast_Int32() => _ints.OrderBy(x => x).Last();
        
            [Benchmark]
            public int OrderLast_Int32() => _ints.Order().Last();
        }
    
    Method
    
    Runtime
    
    Mean
    
    Ratio
    
    Allocated
    
    Alloc Ratio
    
    OrderByLast\_Int32
    
    .NET 8.0
    
    34,715.6 ns
    
    1.00
    
    136 B
    
    1.00
    
    OrderByLast\_Int32
    
    .NET 9.0
    
    25,001.1 ns
    
    0.72
    
    128 B
    
    0.94
    
    OrderLast\_Int32
    
    .NET 8.0
    
    36,064.9 ns
    
    1.00
    
    112 B
    
    1.00
    
    OrderLast\_Int32
    
    .NET 9.0
    
    693.8 ns
    
    0.02
    
    56 B
    
    0.50
    
*   In .NET 8, `Enumerable.Order` was updated to recognize that sorting of certain primitive types is implicitly stable even if an unstable sorting algorithm is used, because any two values of such types that compare equally are indistinguishable in memory (e.g. the only `Int32` values that compare equally are those with the exact same bit patterns in memory). [dotnet/runtime#99533](https://github.com/dotnet/runtime/pull/99533) improves this logic to also handle enums whose underlying type counts.
    
        dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [MemoryDiagnoser(false)]
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            private IEnumerable<DayOfWeek> _days = new Random(42).GetItems(Enum.GetValues<DayOfWeek>(), 100);
        
            [Benchmark]
            public int Order()
            {
                int sum = 0;
                foreach (DayOfWeek dow in _days.Order())
                {
                    sum += (int)dow;
                }
                return sum;
            }
        }
    
    Method
    
    Runtime
    
    Mean
    
    Ratio
    
    Allocated
    
    Alloc Ratio
    
    Order
    
    .NET 8.0
    
    1,652.9 ns
    
    1.00
    
    1088 B
    
    1.00
    
    Order
    
    .NET 9.0
    
    873.0 ns
    
    0.53
    
    544 B
    
    0.50
    
*   In .NET 8, a change was submitted to `Enumerable.Range` to vectorize its operation when followed by methods like `ToArray`. At the time, we had some debate about whether to merge the change, with me asking questions like “Who would actually use `Enumerable.Range(...).ToArray()` on code paths that care about performance?” As it turns out, we do! As part of `OrderBy`‘s stable sort implementation, it had code like this:
    
        int[] map = new int[count];
        for (int i = 0; i < map.Length; i++)
        {
            map[i] = i;
        }
    
    For all intents and purposes, that’s `Enumerable.Range(0, count).ToArray()`. [dotnet/runtime#99538](https://github.com/dotnet/runtime/pull/99538) recognizes this and uses that same vectorized helper to fill this array in a vectorized manner, and that overhead can actually be measurable in some cases.
    
        // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            private IEnumerable<int> _data = Enumerable.Range(0, 1000).ToArray();
        
            [Benchmark]
            public int OrderBy()
            {
                int sum = 0;
                foreach (int value in _data.OrderBy(i => i))
                {
                    sum += value;
                }
        
                return sum;
            }
        }
    
    Method
    
    Runtime
    
    Mean
    
    Ratio
    
    OrderBy
    
    .NET 8.0
    
    14.83 us
    
    1.00
    
    OrderBy
    
    .NET 9.0
    
    13.48 us
    
    0.91
    

`GroupBy` and `ToLookup` also get some dedicated improvements in .NET 9, thanks to [dotnet/runtime#99365](https://github.com/dotnet/runtime/pull/99365). `GetEnumerator` on the grouping object returned by these methods was implemented using a simple C# iterator:

    public IEnumerator<TElement> GetEnumerator()
    {
        for (int i = 0; i < _count; i++)
        {
            yield return _elements[i];
        }
    }

In general we favor using C# iterators over manual implementations (unless we’re going to go all out and implement all of the `Iterator<TSource>` logic) because C# iterators make the code so simple and maintainable. In this particular case, however, this is a reasonably common hot path and we can actually do meaningfully better by hand than the compiler is able to do today. When the compiler generates a state machine for the previous iterator, it does so with a dedicated state field, but with a manual implementation, we can use the same field for state as we use for the iteration variable, which also means we only need to update one thing per loop iteration.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private ILookup<int, string> _stringsByLength =
            (from i in Enumerable.Range(0, 10)
             from item in Enumerable.Range(0, 8)
             select new string((char)('a' + item), i + 1)).ToLookup(s => s.Length);
    
        [Benchmark]
        public int Sum()
        {
            int sum = 0;
            foreach (IGrouping<int, string> group in _stringsByLength)
            {
                foreach (string item in group)
                {
                    sum += item.Length;
                }
            }
            return sum;
        }
    }

Method

Runtime

Mean

Ratio

Sum

.NET 8.0

290.3 ns

1.00

Sum

.NET 9.0

267.4 ns

0.92

### Core Collections

As shared in [Performance Improvements in .NET 8](https://devblogs.microsoft.com/dotnet/performance-improvements-in-net-8/#list), `Dictionary<TKey, TValue>` is one of the most popular collections in all of .NET, by far (probably not surprising to anyone). And in .NET 9, it gets a performance-focused feature I’ve been wanting for years.

One of the most common uses for a dictionary is as a cache, often indexed by a `string` key. And for high-performance scenarios, such caches are frequently used in situations where an actual `string` object may not be available, but where the text is available, just in a different form, like a `ReadOnlySpan<char>` (or for caches indexed by UTF8 data, the key might be a `byte[]` yet the data to perform the lookup is only available as a `ReadOnlySpan<byte>`). Performing the lookup on the dictionary then would either require materializing a string from the data, which makes the lookup more costly (and in some cases can entirely defeat the purposes of the cache), or require using a custom key type that’s capable of handling multiple forms of the data, which then also generally requires a custom comparer.

This has been addressed in .NET 9 with the introduction of `IAlternateEqualityComparer<TAlternate, T>`. A comparer that implements `IEqualityComparer<T>` may now also implement this additional interface one or more times for other `TAlternate` types, making it possible for that comparer to treat alternate types the same as the `T`. Then a type like `Dictionary<TKey, TValue>` can expose additional methods that work in terms of a `TAlternateKey` and allow them to work if the comparer in that `Dictionary<TKey, TValue>` implements `IAlternateEqualityComparer<TAlternateKey, TKey>`. In .NET 9 with [dotnet/runtime#102907](https://github.com/dotnet/runtime/pull/102907) and [dotnet/runtime#103191](https://github.com/dotnet/runtime/pull/103191), `Dictionary<TKey, TValue>`, `ConcurrentDictionary<TKey, TValue>`, `FrozenDictionary<TKey, TValue>`, `HashSet<T>`, and `FrozenSet<T>` all do exactly that. For example, here I have a `Dictionary<string, int>` I’m using to count the number of occurrences of each word in a span:

    static Dictionary<string, int> CountWords1(ReadOnlySpan<char> input)
    {
        Dictionary<string, int> result = new(StringComparer.OrdinalIgnoreCase);
    
        foreach (ValueMatch match in Regex.EnumerateMatches(input, @"\b\w+\b"))
        {
            ReadOnlySpan<char> word = input.Slice(match.Index, match.Length);
            string key = word.ToString();
            result[key] = result.TryGetValue(key, out int count) ? count + 1 : 1;
        }
    
        return result;
    }

I’m returning a `Dictionary<string, int>`, so I certainly need to materialize the `string` for each `ReadOnlySpan<char>` in order to _store_ it in the dictionary, but I should only need to do so once, the first time the word is found. I shouldn’t need to create a new string each time, yet I’m having to in order to do the `TryGetValue` call. Now with .NET 9, a new `GetAlternateLookup` method (and a corresponding `TryGetAlternateLookup`) exists to produce a separate value type wrapper that enables using an alternate key type for all the relevant operations, which means I can now write this:

    static Dictionary<string, int> CountWords2(ReadOnlySpan<char> input)
    {
        Dictionary<string, int> result = new(StringComparer.OrdinalIgnoreCase);
        Dictionary<string, int>.AlternateLookup<ReadOnlySpan<char>> alternate = result.GetAlternateLookup<ReadOnlySpan<char>>();
    
        foreach (ValueMatch match in Regex.EnumerateMatches(input, @"\b\w+\b"))
        {
            ReadOnlySpan<char> word = input.Slice(match.Index, match.Length);
            alternate[word] = alternate.TryGetValue(word, out int count) ? count + 1 : 1;
        }
    
        return result;
    }

Note the distinct lack of a `ToString()`, which means no allocation will occur here for words already seen. How then does the `alternate[word] = ...` part work? Surely this isn’t storing a `ReadOnlySpan<char>` into the dictionary? Nope. Rather, `IAlternateEqualityComparer<TAlternate, T>` looks like this:

    public interface IAlternateEqualityComparer<in TAlternate, T>
        where TAlternate : allows ref struct
        where T : allows ref struct
    {
        bool Equals(TAlternate alternate, T other);
        int GetHashCode(TAlternate alternate);
        T Create(TAlternate alternate);
    }

The `Equals` and `GetHashCode` should look familiar, the main difference from the corresponding members of `IEqualityComparer<T>` just being the type of the first parameter. But then there’s this additional `Create` method. That method accepts a `TAlternate` and returns a `T`, giving the comparer the ability to map from one to the other. That setter we saw previously (and other methods like `TryAdd`) are able to use this to only create the `TKey` from the `TAlternateKey` when they have to, so the setter here will only allocate the string for the word if the word doesn’t already exist in the collection.

Another possibly perplexing thing for anyone reading this and who’s well versed in the ways of `ReadOnlySpan<T>`: how in the world is `Dictionary<string, int>.AlternateLookup<ReadOnlySpan<char>>` valid? `ref struct`s like span can’t be used as generic parameters, right? Right… until now. C# 13 and .NET 9 now permit `ref struct`s as generic parameters, but the generic parameter needs to opt-in to it via the new `allows ref struct` constraint (or “anti-constraint” as some of us frequently refer to it). There are things a method can do with an instance of an unconstrained generic parameter, like cast it to `object` or store it into a field of a class, that can’t be done with `ref struct`. By adding `allows ref struct` to a generic parameter, it tells the compiler compiling the consumer that it may specify a `ref struct`, and it tells the compiler compiling the type or method with the constraint that the generic instantiation might be a `ref struct` and thus the generic parameter can only be used in situations where a `ref struct` would be legal.

Of course, all of this working hinges on the supplied comparer sporting the appropriate `IAlternateEqualityComparer<TAlternate, T>` implementation; if it doesn’t, attempts to call `GetAlternateLookup` will throw an exception, and attempts to call `TryGetAlternateLookup` will return `false`. You can use these collection types with whatever comparer you want, and that comparer can provide implementations of this interface for whatever alternate key types you want. But with `string` and `ReadOnlySpan<char>` being so common, it’d be a shame if there wasn’t built-in support for this combination. And indeed, with the aforementioned PRs, all of the built-in `StringComparer` types implement `IAlternateEqualityComparer<ReadOnlySpan<char>, string>`. That’s why the `Dictionary<string, int> result = new(StringComparer.OrdinalIgnoreCase);` line is successful in the previous code example, as the subsequent call to `result.GetAlternateLookup<ReadOnlySpan<char>>()` will successfully find the interface on the supplied comparer.

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Text.RegularExpressions;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public partial class Tests
    {
        private static readonly string s_input = new HttpClient().GetStringAsync("https://gutenberg.org/cache/epub/2600/pg2600.txt").Result;
    
        [GeneratedRegex(@"\b\w+\b")]
        private static partial Regex WordParser();
    
        [Benchmark(Baseline = true)]
        public Dictionary<string, int> CountWords1()
        {
            ReadOnlySpan<char> input = s_input;
    
            Dictionary<string, int> result = new(StringComparer.OrdinalIgnoreCase);
    
            foreach (ValueMatch match in WordParser().EnumerateMatches(input))
            {
                ReadOnlySpan<char> word = input.Slice(match.Index, match.Length);
                string key = word.ToString();
                result[key] = result.TryGetValue(key, out int count) ? count + 1 : 1;
            }
    
            return result;
        }
    
        [Benchmark]
        public Dictionary<string, int> CountWords2()
        {
            ReadOnlySpan<char> input = s_input;
    
            Dictionary<string, int> result = new(StringComparer.OrdinalIgnoreCase);
            Dictionary<string, int>.AlternateLookup<ReadOnlySpan<char>> alternate = result.GetAlternateLookup<ReadOnlySpan<char>>();
    
            foreach (ValueMatch match in WordParser().EnumerateMatches(input))
            {
                ReadOnlySpan<char> word = input.Slice(match.Index, match.Length);
                alternate[word] = alternate.TryGetValue(word, out int count) ? count + 1 : 1;
            }
    
            return result;
        }
    }

Method

Mean

Ratio

Allocated

Alloc Ratio

CountWords1

60.35 ms

1.00

20.67 MB

1.00

CountWords2

57.40 ms

0.95

2.54 MB

0.12

Note the huge reduction in allocation.

For fun, we can also take this example one step further. .NET 6 introduced the `CollectionsMarshal.GetValueRefOrAddDefault` method, which returns a writable `ref` to the actual location where the `TValue` for a given `TKey` is stored, creating the entry in the dictionary if it doesn’t exist. This is very handy for operations like the one used above, as it helps to avoid an extra dictionary lookup. Without it, we’re doing one lookup as part of the `TryGetValue` and then another lookup as part of the setter, but with it, we just do the single lookup as part of `GetValueRefOrAddDefault` and then no additional lookup is necessary because we already have the location into which we can directly write. And as the lookups in this benchmark are one of the more costly elements, eliminating half of them can significantly reduce the cost of the operation. As part of this alternate key effort, a new overload of `GetValueRefOrAddDefault` was added that works with it, such that the same operation can be performed with a `TAlternateKey`.

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Runtime.InteropServices;
    using System.Text.RegularExpressions;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public partial class Tests
    {
        private static readonly string s_input = new HttpClient().GetStringAsync("https://gutenberg.org/cache/epub/2600/pg2600.txt").Result;
    
        [GeneratedRegex(@"\b\w+\b")]
        private static partial Regex WordParser();
    
        [Benchmark(Baseline = true)]
        public Dictionary<string, int> CountWords1()
        {
            ReadOnlySpan<char> input = s_input;
    
            Dictionary<string, int> result = new(StringComparer.OrdinalIgnoreCase);
    
            foreach (ValueMatch match in WordParser().EnumerateMatches(input))
            {
                ReadOnlySpan<char> word = input.Slice(match.Index, match.Length);
                string key = word.ToString();
                result[key] = result.TryGetValue(key, out int count) ? count + 1 : 1;
            }
    
            return result;
        }
    
        [Benchmark]
        public Dictionary<string, int> CountWords2()
        {
            ReadOnlySpan<char> input = s_input;
    
            Dictionary<string, int> result = new(StringComparer.OrdinalIgnoreCase);
            Dictionary<string, int>.AlternateLookup<ReadOnlySpan<char>> alternate = result.GetAlternateLookup<ReadOnlySpan<char>>();
    
            foreach (ValueMatch match in WordParser().EnumerateMatches(input))
            {
                ReadOnlySpan<char> word = input.Slice(match.Index, match.Length);
                alternate[word] = alternate.TryGetValue(word, out int count) ? count + 1 : 1;
            }
    
            return result;
        }
    
        [Benchmark]
        public Dictionary<string, int> CountWords3()
        {
            ReadOnlySpan<char> input = s_input;
    
            Dictionary<string, int> result = new(StringComparer.OrdinalIgnoreCase);
            Dictionary<string, int>.AlternateLookup<ReadOnlySpan<char>> alternate = result.GetAlternateLookup<ReadOnlySpan<char>>();
    
            foreach (ValueMatch match in WordParser().EnumerateMatches(input))
            {
                ReadOnlySpan<char> word = input.Slice(match.Index, match.Length);
                CollectionsMarshal.GetValueRefOrAddDefault(alternate, word, out _)++;
            }
    
            return result;
        }
    }

Method

Mean

Ratio

Allocated

Alloc Ratio

CountWords1

60.73 ms

1.00

20.67 MB

1.00

CountWords2

54.01 ms

0.89

2.54 MB

0.12

CountWords3

44.38 ms

0.73

2.54 MB

0.12

“But wait, there’s more!” [dotnet/runtime#104202](https://github.com/dotnet/runtime/pull/104202) extends the alternate comparer implementation for `string`/`ReadOnlySpan<char>` further to also apply to `EqualityComparer<string>.Default`, which means that if you don’t supply a comparer at all, these collection types will still support `ReadOnlySpan<char>` lookups. That change not only then improves the usability of these new APIs, but it actually had an additional unintended but welcome performance benefit. Previously, `EqualityComparer<string>.Default` would return an internal `GenericEqualityComparer<string>` type, derived from `EqualityComparer<string>`. It wouldn’t be possible to implement `IAlternateEqualityComparer<ReadOnlySpan<char>, string>` on `GenericEqualityComparer<string>` because doing so would actually have to be done on `GenericEqualityComparer<T>`, which would mean every `EqualityComparer<T>.Default` would support `IAlternateEqualityComparer<ReadOnlySpan<char>, T>`, and we have no correct way of providing such an implementation for all `T`s. Instead, we introduced a new internal non-generic `StringEqualityComparer` type and made `EqualityComparer<T>.Default` return an instance of that when `T` is `string` (the implementation of `Default` already knows about and returns a bunch of specialized comparers, this is just one more). In doing so, it made the type that’s used non-generic, which in turn means that in some situations, it eliminates some of the overhead associated with generics.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Runtime.CompilerServices;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private IEqualityComparer<string> _comparer = EqualityComparer<string>.Default;
        private string[] _values = Enumerable.Range(0, 1000).Select(i => i.ToString()).ToArray();
    
        [Benchmark]
        public int Count() => CountEquals(_values, "500", _comparer);
    
        [MethodImpl(MethodImplOptions.NoInlining)]
        private static int CountEquals<T>(T[] haystack, T needle, IEqualityComparer<T> comparer)
        {
            int count = 0;
            foreach (T value in haystack)
            {
                if (comparer.Equals(value, needle))
                {
                    count++;
                }
            }
            return count;
        }
    }

Method

Runtime

Mean

Ratio

Count

.NET 8.0

4.477 us

1.00

Count

.NET 9.0

2.808 us

0.63

`HashSet<T>` also gains all of these super powers, but several additional PRs went into making other performance improvements to it. [dotnet/runtime#85877](https://github.com/dotnet/runtime/pull/85877) from [@hrrrrustic](https://github.com/hrrrrustic) added a `TrimExcess(int capacity)` method to `HashSet<T>` (as well as to `Queue<T>` and `Stack<T>`), enabling more fine-grained control over how much memory to cull from a set that might have grown larger than is now required. And [dotnet/runtime#102758](https://github.com/dotnet/runtime/pull/102758) from [@lilinus](https://github.com/lilinus) improved its `IsSubsetOf`, `IsProperSubsetOf`, and `SetEquals` methods by tweaking the fast paths already present. The methods were attempting to early-exit as soon as the condition could be proved `true` or `false`, but some common conditions were being missed, and this rectified those.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private HashSet<int> _set = new(Enumerable.Range(0, 1000));
        private List<int> _list = Enumerable.Range(0, 999).ToList();
    
        [Benchmark]
        public bool IsSubsetOf() => _set.IsSubsetOf(_list);
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

IsSubsetOf

.NET 8.0

7,351.373 ns

1.000

40 B

1.00

IsSubsetOf

.NET 9.0

1.216 ns

0.000

–

0.00

[dotnet/runtime#96573](https://github.com/dotnet/runtime/pull/96573) from [@ndsvw](https://github.com/ndsvw) also identified a few places in various libraries where a `Dictionary<T, T>` was being used as a set and replaced them with `HashSet<T>`. The implementations of `Dictionary<>` and `HashSet<>` are very close in nature, but the latter consumes less memory because it doesn’t need to store separate values. Using a `Dictionary<T, T>` effectively doubles the required storage, so if a `HashSet<T>` suffices, it’s preferable.

A variety of other collection types have also seen improvements in .NET 9:

*   **`PriorityQueue<TElement, TPriority>`.** The `EnqueueRange(IEnumerable<Telement>, TPriority)` method enables multiple elements to all be inserted at the same priority. If there are already elements in the collection, this is akin to just calling `Enqueue` for each. However, if the collection is currently empty, then it can skip the per-element addition costs and instead just store the elements directly into the backing array. After doing so, it was then performing a heapify operation. But [dotnet/runtime#99139](https://github.com/dotnet/runtime/pull/99139) from [@skyoxZ](https://github.com/skyoxZ) recognized that this heapify was entirely unnecessary, because all of the elements were inserted at the same priority, and there were no elements of any other priority already in the collection. Many performance optimizations come with trade-offs, making one common thing much faster at the expense of making some less common thing a little slower. This, however, is my favorite kind of optimization: elimination of unnecessary work with effectively zero downside.
    
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [DisassemblyDiagnoser]
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            private PriorityQueue<int, int> _pq = new();
            private int[] _elements = Enumerable.Range(0, 100).ToArray();
        
            [Benchmark]
            public void EnqueueRange()
            {
                _pq.Clear();
                _pq.EnqueueRange(_elements, priority: 42);
            }
        }
    
    Method
    
    Runtime
    
    Mean
    
    Ratio
    
    EnqueueRange
    
    .NET 8.0
    
    239.3 ns
    
    1.00
    
    EnqueueRange
    
    .NET 9.0
    
    206.7 ns
    
    0.86
    
*   **`BitArray`.** Multiple methods on `BitArray` are already accelerated using `Vector128` and `Vector256`, enabling much faster throughput for methods like `And`, `Or`, and `Not`. [dotnet/runtime#91903](https://github.com/dotnet/runtime/pull/91903) from [@khushal1996](https://github.com/khushal1996) adds `Vector512` support to all of these as well, enabling hardware with AVX512 support to process these operations upwards of twice as fast as before.
    
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        using System.Collections;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            private BitArray _first = new BitArray(1024 * 1024);
            private BitArray _second = new BitArray(1024 * 1024);
        
            [Benchmark]
            public void Or() => _first.Or(_second);
        }
    
    Method
    
    Runtime
    
    Mean
    
    Ratio
    
    Or
    
    .NET 8.0
    
    2.894 us
    
    1.00
    
    Or
    
    .NET 9.0
    
    2.354 us
    
    0.81
    
*   **`List<T>`.** [dotnet/runtime#90089](https://github.com/dotnet/runtime/pull/90089) from [@karakasa](https://github.com/karakasa) avoided an extra `Array.Copy` call as part of `Insert`. Previously the implementation may have done up to three `Array.Copy` operations, and as part of this change that can drop to just two.
*   **`FrozenDictionary<TKey, TValue>` and `FrozenSet<T>`.** These frozen collections introduced in .NET 8 have also received some attention in .NET 9. As a reminder, `FrozenDictionary<TKey, TValue>` and `FrozenSet<T>` are immutable collections optimized for reading, willing to spend more time and effort during construction to make subsequent operations on the collections as fast as possible. When the `TKey`/`T` is a `string`, one optimization employed is to track the minimum and maximum lengths of all strings in the collection; if a `string` that’s shorter or longer than that is used in a lookup, the collection can immediately report that it’s not in the collection without having to actually perform any lookup, instead just comparing against the min and max. [dotnet/runtime#92546](https://github.com/dotnet/runtime/pull/92546) from [@andrewjsaid](https://github.com/andrewjsaid) extends this further by employing a bitmap of up to 64 bits corresponding to lengths of strings contained in the collection. On lookup, rather than only comparing against min/max, the implementation can test whether the corresponding bit for the `string`‘s length is set, bailing immediately if it’s not. [dotnet/runtime#100998](https://github.com/dotnet/runtime/pull/100998) also reduced creation overheads with frozen collections created with `string` keys and `StringComparer.OrdinalIgnoreCase`. The implementation had been using its own custom comparison logic for hash code generation, in order to support building for `netstandard2.0` in addition to .NET Core, but this PR specialized the code for .NET Core to use `string.GetHashCode(ReadOnlySpan<char>, StringComparison)`, which is more efficient than the custom implementation.
    
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        using System.Collections.Frozen;
        using System.Text.RegularExpressions;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            private static readonly FrozenSet<string> s_words = Regex.Matches("""
                Let me not to the marriage of true minds
                Admit impediments; love is not love
                Which alters when it alteration finds,
                Or bends with the remover to remove.
                O no, it is an ever-fixed mark
                That looks on tempests and is never shaken;
                It is the star to every wand'ring bark
                Whose worth's unknown, although his height be taken.
                Love's not time's fool, though rosy lips and cheeks
                Within his bending sickle's compass come.
                Love alters not with his brief hours and weeks,
                But bears it out even to the edge of doom:
                If this be error and upon me proved,
                I never writ, nor no man ever loved.
                """, @"\b\w+\b").Cast<Match>().Select(w => w.Value).ToFrozenSet();
            private string _word = "quickness";
        
            [GlobalSetup] public void Setup() => Console.WriteLine(s_words);
        
            [Benchmark]
            public bool Contains() => s_words.Contains(_word);
        }
    
    Method
    
    Runtime
    
    Mean
    
    Ratio
    
    Contains
    
    .NET 8.0
    
    4.373 ns
    
    1.00
    
    Contains
    
    .NET 9.0
    
    1.154 ns
    
    0.26
    

Compression
-----------

It’s an important goal of the core .NET libraries to be as platform-agnostic as possible. Things should generally behave the same way regardless of which operating system or which hardware is being used, excepting things that really are operating system or hardware specific (e.g. we purposefully don’t try to paper over casing differences of different file systems). To that end, we generally implement as much as possible in C#, deferring down to the operating system and native platform libraries only when necessary; for example, the default .NET HTTP implementation, `System.Net.Http.SocketsHttpHandler`, is written in C# on top of `System.Net.Sockets`, `System.Net.Dns`, etc., and subject to the implementation of sockets on each platform (where behaviors are implemented by the operating system), generally behaves the same wherever you’re running.

There are, however, just a few specific places where we’ve actively made the choice to defer more to something in the platform. The most important case here is cryptography, where we want to rely on the operating system for such security-related functionality; so on Windows, for example, TLS is implemented in terms of components like `SChannel`, on Linux in terms of `OpenSSL`, and on macOS in terms of `SecureTransport`. The other notable case has been compression, and in particular `zlib`. We decided long ago to simply use whatever `zlib` was distributed with the operating system. That has had various implications, however. Starting with the fact that Windows doesn’t ship with `zlib` as a library exposed for consumption, so the .NET build targeting Windows still had to include its own copy of `zlib`. That was then improved but also complicated by a decision to switch to distribute a variant of `zlib` produced by Intel, which was nicely optimized further for x64, but which didn’t have as much attention paid to other hardware, like Arm64. And very recently, the `intel/zlib` repository was archived and is not actively being maintained by Intel.

To simplify things, to improve consistency and performance across more platforms, and to move to an actively supported and evolving implementation, this changes for .NET 9. Thanks to a stream of PRs, and in particular [dotnet/runtime#104454](https://github.com/dotnet/runtime/pull/104454) and [dotnet/runtime#105771](https://github.com/dotnet/runtime/pull/105771), .NET 9 now includes the `zlib` functionality built-in across Windows, Linux, and macOS, based on the newer [`zlib-ng/zlib-ng`](https://github.com/zlib-ng/zlib-ng). `zlib-ng` is a `zlib`\-compatible API that is actively maintained, includes improvements previously made to both Intel and Cloudflare’s forks, and has received improvements across many different CPU intrinsics.

Benchmarking just throughput is easy with BenchmarkDotNet. Unfortunately, while I love the tool, the lack of [dotnet/BenchmarkDotNet#784](https://github.com/dotnet/BenchmarkDotNet/issues/784) makes it very challenging to appropriately benchmark compression, because throughput is only one part of the equation. Compression ratio is also a key part of the equation (you can make “compression” super fast by just outputting the input without actually manipulating it at all), so we also need to know about compressed output size when discussing compression speeds. To do that for this post, I’ve hacked up just enough in this benchmark to make it work for this example, implementing a custom column for BenchmarkDotNet, but please note this is not a general-purpose implementation.

    // dotnet run -c Release -f net8.0 --filter "*"
    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Columns;
    using BenchmarkDotNet.Configs;
    using BenchmarkDotNet.Reports;
    using BenchmarkDotNet.Running;
    using System.IO.Compression;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(
        args,
        DefaultConfig.Instance.AddColumn(new CompressedSizeColumn()));
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private byte[] _uncompressed = new HttpClient().GetByteArrayAsync(@"https://www.gutenberg.org/cache/epub/3200/pg3200.txt").Result;
    
        [Params(CompressionLevel.NoCompression, CompressionLevel.Fastest, CompressionLevel.Optimal, CompressionLevel.SmallestSize)]
        public CompressionLevel Level { get; set; }
    
        private MemoryStream _compressed = new MemoryStream();
    
        private long _compressedSize;
    
        [Benchmark]
        public void Compress()
        {
            _compressed.Position = 0;
            _compressed.SetLength(0);
    
            using (var ds = new DeflateStream(_compressed, Level, leaveOpen: true))
            {
                ds.Write(_uncompressed, 0, _uncompressed.Length);
            }
    
            _compressedSize = _compressed.Length;
        }
    
        [GlobalCleanup]
        public void SaveSize()
        {
            File.WriteAllText(Path.Combine(Path.GetTempPath(), $"Compress_{Level}"), _compressedSize.ToString());
        }
    }
    
    public class CompressedSizeColumn : IColumn
    {
        public string Id => nameof(CompressedSizeColumn);
        public string ColumnName { get; } = "CompressedSize";
        public bool AlwaysShow => true;
        public ColumnCategory Category => ColumnCategory.Custom;
        public int PriorityInCategory => 1;
        public bool IsNumeric => true;
        public UnitType UnitType { get; } = UnitType.Size;
        public string Legend => "CompressedSize Bytes";
        public bool IsAvailable(Summary summary) => true;
        public bool IsDefault(Summary summary, BenchmarkCase benchmarkCase) => true;
        public string GetValue(Summary summary, BenchmarkCase benchmarkCase, SummaryStyle style) =>
            GetValue(summary, benchmarkCase);
        public string GetValue(Summary summary, BenchmarkCase benchmarkCase) =>
            File.ReadAllText(Path.Combine(Path.GetTempPath(), $"Compress_{benchmarkCase.Parameters.Items[0].Value}")).Trim();
    }

Running that for .NET 8, I get this:

Method

Level

Mean

CompressedSize

Compress

NoCompression

1.783 ms

16015049

Compress

Fastest

164.495 ms

7312367

Compress

Optimal

620.987 ms

6235314

Compress

SmallestSize

867.076 ms

6208245

and for .NET 9, I get this:

Method

Level

Mean

CompressedSize

Compress

NoCompression

1.814 ms

16015049

Compress

Fastest

64.345 ms

9578398

Compress

Optimal

230.646 ms

6276158

Compress

SmallestSize

567.579 ms

6215048

A few interesting things to note here:

*   On both .NET 8 and .NET 9, there’s an obvious correlation: the more compression is requested, the slower it gets and the smaller the file size becomes.
*   `NoCompression`, which really just echos the input bytes back as output, produces the exact same compressed size across .NET 8 and .NET 9, as one would hope; the compressed size should be identical to the input size.
*   The compressed size for `SmallestSize` is almost the same between .NET 8 and .NET 9; they differ by only ~0.1%, but for that small increase, the `SmallestSize` throughput ends up being ~35% faster. In both cases, the .NET layer is just passing down a zlib compression level of 9, which is the largest value possible and denotes best-possible compression. It just happens that with `zlib-ng`, that best possible compression is significantly faster and just a tad bit worse compression-ratio-wise than with `zlib`.
*   For `Optimal`, which is also the default and represents a balanced tradeoff between speed and compression ratio (with 20/20 hindsight, the name for this member should have been `Balanced`), the .NET 9 version using `zlib-ng` is 60% faster while only sacrificing ~0.6% on compression ratio.
*   `Fastest` is interesting. The .NET implementation is just passing down a compression level of 1 to the `zlib-ng` native code, indicating to choose the fastest speed while still doing _some_ compression (0 means don’t compress at all). But the `zlib-ng` implementation is obviously making different trade-offs than did the older `zlib` code, as it’s truer to its name: it’s running more than 2x as fast and still compressing, but the compressed output is ~30% larger than the output on .NET 8.

The net effect of this is, especially if you’re using `Fastest`, you might want to re-evaluate to see whether the throughput / compression ratios meet your needs. If you want to tweak it further, though, you’re no longer limited to just these options. [dotnet/runtime#105430](https://github.com/dotnet/runtime/pull/105430) adds new constructors to `DeflateStream`, `GZipStream`, `ZLibStream`, and also the unrelated `BrotliStream`, enabling more fine-grained control over the parameters passed to the native implementations, e.g.

    private static readonly ZLibCompressionOptions s_options = new ZLibCompressionOptions()
    {
        CompressionLevel = 2,
    };
    ...
    Stream sourceStream = ...;
    using var ds = new DeflateStream(compressed, s_options, leaveOpen: true)
    {
        sourceStream.CopyTo(ds);
    }

Cryptography
------------

<strudel-editor>
setcps(1)
n("<0 1 2 3 4>*8")
  .scale('G4 minor')
  .s("gm_lead_6_voice")
  .clip(sine.range(.2,.8).slow(8))
  .jux(rev)
  .room(2)
  .sometimes(add(note("12")))
  .lpf(perlin.range(200,20000).slow(4))
</strudel-editor>

Investments in `System.Security.Cryptography` are generally focused on improving the security of a system, supporting new cryptographic primitives, better integrating with security capabilities of the underlying operating system, and so on. But as cryptography is ever present in most modern systems, it’s also impactful to make the existing functionality more efficient, and a variety of PRs in .NET 9 have done so.

Let’s start with random number generation. .NET 8 added a new `GetItems` method to both `Random` (the core non-cryptographically-secure random number generator) and `RandomNumberGenerator` (the core cryptographically-secure random number generator). This method is very handy when you need to randomly generate N elements sourced from a specific set of values. For example, if you wanted to write 100 random hex characters to a destination `Span<char>`, you could do:

    Span<char> dest = stackalloc char[100];
    Random.Shared.GetItems("0123456789abcdef", dest);

The core implementation is very simple, and is just a convenience implementation for something you could easily do yourself:

    for (int i = 0; i < dest.Length; i++)
    {
        dest[i] = choices[Next(choices.Length)];
    }

Easy peasy. However, in some situations we can do better. This implementation ends up making a call to the random number generator for each element, and that roundtrip adds measurable overhead. If we could instead make fewer calls, we could ammortize that overhead across however many elements could be filled by that single call. That’s exactly what [dotnet/runtime#92229](https://github.com/dotnet/runtime/pull/92229) does. If the number of choices is less than or equal to 256 and a power of two, rather than asking for a random integer for each element, we can instead get a byte for each element, and we can do that in bulk with a single call to NextBytes. The max of 256 choices is because that’s the number of values a byte can represent, and the power of two is so that we can simply mask off unnecessary bits from the byte, which helps to avoid bias. This makes a measurable impact for `Random`, but even more so for `RandomNumberGenerator`, where each call to get random bytes requires a transition into the operating system.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Security.Cryptography;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private char[] _dest = new char[100];
    
        [Benchmark]
        public void GetRandomHex() => RandomNumberGenerator.GetItems<char>("0123456789abcdef", _dest);
    }

Method

Runtime

Mean

Ratio

GetRandomHex

.NET 8.0

58,659.2 ns

1.00

GetRandomHex

.NET 9.0

746.5 ns

0.01

Sometimes performance improvements are about revisiting past assumptions. .NET 5 added a new `GC.AllocateArray` method which optionally allows that array to be created on the “pinned object heap,” or POH. Allocating on the POH is the same as allocating normally, except that the GC guarantees that objects on the POH won’t be moved (normally the GC is free to compact the heap, moving objects around in order to reduce fragmentation). This is a useful guarantee for cryptography, which employs defense-in-depth measures like zero’ing out buffers to reduce the chances of an attacker being able to find sensitive information in the memory (or memory dump) of a process. The crypto library wants to be able to allocate some memory, use it to temporarily contain some sensitive information, and then zero out the memory before stopping using it, but if the GC is able to move the object around in the interim, it could end up leaving shadows of the data on the heap. When the POH was introduced, then, `System.Security.Cryptography` started using it, including for relatively short-lived objects. This is potentially problematic, however. Because the nature of the POH is that objects can’t be moved around, creating short-lived objects on the POH can significantly increase fragmentation, which can in turn increase memory consumption, GC costs, and so on. And as a result, the POH is really only recommended for long-lived objects, ideally ones that you create and then hold onto for the remainder of the process’ lifetime. [dotnet/runtime#99168](https://github.com/dotnet/runtime/pull/99168) undid `System.Security.Cryptography`‘s reliance on the POH, instead preferring to use native memory (e.g. via `NativeMemory.Alloc` and `NativeMemory.Free`) for such needs.

On the subject of memory, multiple PRs went into the crypto libraries to reduce allocation. Here are some examples:

*   **Marshaling pointers instead of temporary arrays.** The `CngKey` type exposes properties like `ExportPolicy`, `IsMachineKey`, and `KeyUsage`, all of which utilize an internal `GetPropertyAsDword` method that P/Invokes to retrieve an integer from Windows. It was doing so, however, via a shared helper that was allocating a 4-byte `byte[]`, passing that to the OS to fill, and then converting those four bytes into an `int`. [dotnet/runtime#91521](https://github.com/dotnet/runtime/pull/91521) changed the interop path to instead just store the `int` on the stack, passing a pointer to it to the OS, avoiding the need to allocate and parse.
*   **Special-casing empty.** Throughout the core libraries, we rely heavily on `Array.Empty<T>()` to avoid allocating lots of empty arrays when we could instead just employ singletons. The crypto libraries work with a lot of arrays, and as part of defense-in-depth, will often hand out clones of those arrays rather than handing out the same array to everyone; that’s handled by a shared `CloneByteArray` helper. As it turns out, however, it’s reasonably common for arrays to be empty, yet `CloneByteArray` wasn’t special-casing them, and was thus always allocating new arrays even if the input was empty. [dotnet/runtime#93231](https://github.com/dotnet/runtime/pull/93231) simply special-cased empty input arrays to return themselves rather than clone them.
*   **Avoiding unnecessary defensive copies.** [dotnet/runtime#97108](https://github.com/dotnet/runtime/pull/97108) avoids more defensive copies than just those for empty arrays mentioned above. The `PublicKey` type is passed two `AsnEncodedData` instances, one for parameters and one for a key value, and both of which it clones to avoid any issues that might arise with that provided instance being mutated. But in some internal uses, the caller is constructing a temporary `AsnEncodedData` and effectively transferring ownership, yet `PublicKey` would still then make a defensive copy, even though the temporary could have just been used in its stead. This change enables the original instances to just be used without copy in such cases.
*   **Using collection expressions with spans.** One of the really neat things about the collection expressions feature introduced in C# 11 is it allows you to express your intent for what you want and allow the system to implement that as best it can. As part of initializing `OidLookup`, it had multiple lines that look like this:
    
        AddEntry("1.2.840.10045.3.1.7", "ECDSA_P256", new[] { "nistP256", "secP256r1", "x962P256v1", "ECDH_P256" });
        AddEntry("1.3.132.0.34", "ECDSA_P384", new[] { "nistP384", "secP384r1", "ECDH_P384" });
        AddEntry("1.3.132.0.35", "ECDSA_P521", new[] { "nistP521", "secP521r1", "ECDH_P521" });
    
    This effectively forced it to allocate these arrays, even though the `AddEntry` method doesn’t actually require the array-ness and just iterates through the supplied values. [dotnet/runtime#100252](https://github.com/dotnet/runtime/pull/100252) changed `AddEntry` to take a `ReadOnlySpan<string>` instead of `string[]`, and changed all the call sites to be collection expressions:
    
        AddEntry("1.2.840.10045.3.1.7", "ECDSA_P256", ["nistP256", "secP256r1", "x962P256v1", "ECDH_P256"]);
        AddEntry("1.3.132.0.34", "ECDSA_P384", ["nistP384", "secP384r1", "ECDH_P384"]);
        AddEntry("1.3.132.0.35", "ECDSA_P521", ["nistP521", "secP521r1", "ECDH_P521"]);
    
    allowing the compiler to do the “right thing.” All of those call sites then instead just end up using stack space to store the strings passed to `AddEntry`, rather than allocating any arrays at all.
    
*   **Presizing collections.** Many collections, such as `List<T>` or `Dictionary<TKey, TValue>`, allow you to create a new one, with no a priori knowledge of how large they’ll grow to be, and internally they handle growing their storage to accommodate additional data. The growth algorithm employed typically involves doubling capacity, as doing so strikes a reasonable balance between possibly wasting some memory and not having to re-grow too frequently. However, such growing does have overhead, avoiding it is desirable, and so many collections offer the ability to pre-size the capacity of the collection, e.g. `List<T>` has a constructor that accepts an `int capacity`, where the list will immediately create a backing store large enough to accommodate that many elements. The `OidCollection` in cryptography didn’t have such a capability even though many of the places it was being created did know the exact required size, which in turn results in unnecessary allocation and copying as the collection grows to reach the target size. [dotnet/runtime#97106](https://github.com/dotnet/runtime/pull/97106) added such a constructor internally and used it in various places, in order to avoid that overhead. As with `OidCollection`, `CborWriter` also lacked the ability to presize, making the aforementioned growth algorithm problem even more stark. [dotnet/runtime#92538](https://github.com/dotnet/runtime/pull/92538) added such a constructor.
*   **Avoiding `O(N^2)` growth algorithms.** [dotnet/runtime#92435](https://github.com/dotnet/runtime/pull/92435) from [@MichalPetryka](https://github.com/MichalPetryka) fixes a good example of what happens when you _don’t_ employ such a doubling scheme as part of collection resizing. The algorithm used to grow the buffer used by `CborWriter` would increase the backing buffer by a fixed number of elements each time. A doubling strategy ensures you need no more than `O(log N)` growth operations, and ensures that `N` items can be added to a collection in `O(N)` time, since the number of element copies will be `O(2N)`, which is just `O(N)` (e.g. if N == 128, and you start with a buffer of size 1, and you grow to 2, then 4, 8, 16, 32, 64, and 128, that’s 1 + 2 + 4 + 8 + 16 + 32 + 64 + 128, which is 255, or just under twice N). But increasing by a fixed number can mean `O(N)` such operations. And since each growth operation also needs to copy all the elements (assuming the growing is done by array resizing), that makes the algorithm `O(N^2)`. In the extreme, if that fixed number was 1, and we were again growing from 1 to 128 one at a time, that’s just summing all the numbers from 1 to 128, the formula for which is `N(N+1)/2`, which is `O(N^2)`. This PR changed `CborWriters`‘s growth strategy to use doubling instead.
    
        // Add a <PackageReference Include="System.Formats.Cbor" Version="8.0.0" /> to the csproj.
        // dotnet run -c Release -f net8.0 --filter "*"
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Configs;
        using BenchmarkDotNet.Environments;
        using BenchmarkDotNet.Jobs;
        using BenchmarkDotNet.Running;
        using System.Formats.Cbor;
        
        var config = DefaultConfig.Instance
            .AddJob(Job.Default.WithRuntime(CoreRuntime.Core80).WithNuGet("System.Formats.Cbor", "8.0.0").AsBaseline())
            .AddJob(Job.Default.WithRuntime(CoreRuntime.Core90).WithNuGet("System.Formats.Cbor", "9.0.0-rc.1.24431.7"));
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args, config);
        
        [MemoryDiagnoser(false)]
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD", "NuGetReferences")]
        public class Tests
        {
            [Benchmark]
            public CborWriter Test()
            {
                const int NumArrayElements = 100_000;
        
                CborWriter writer = new();
                writer.WriteStartArray(NumArrayElements);
                for (int i = 0; i < NumArrayElements; i++)
                {
                    writer.WriteInt32(i);
                }
                writer.WriteEndArray();
        
                return writer;
            }
        }
    
    Method
    
    Runtime
    
    Mean
    
    Ratio
    
    Allocated
    
    Alloc Ratio
    
    Test
    
    .NET 8.0
    
    25,185.2 us
    
    1.00
    
    65350.11 KB
    
    1.00
    
    Test
    
    .NET 9.0
    
    697.2 us
    
    0.03
    
    1023.82 KB
    
    0.02
    

Of course, improving performance is more than just avoiding allocation. A variety of changes helped in other ways.

[dotnet/runtime#99053](https://github.com/dotnet/runtime/pull/99053) “memoizes” (caches) various properties on `CngKey` that are accessed multiple times but where the answer stays the same from call to call; it does so simply by adding a few fields to the type to cache these values, which is a significant win if any is accessed multiple times over the lifetime of the object. The affected properties (`Algorithm`, `AlgorithmGroup`, and `Provider`) are particularly expensive because the OS implementation of these functions needs to make a remote procedure call to another Windows process to access the relevant data.

    // Windows-only test.
    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Security.Cryptography;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private RSACng _rsa = new RSACng(2048);
    
        [GlobalCleanup]
        public void Cleanup() => _rsa.Dispose();
    
        [Benchmark]
        public CngAlgorithm GetAlgorithm() => _rsa.Key.Algorithm;
    
        [Benchmark]
        public CngAlgorithmGroup? GetAlgorithmGroup() => _rsa.Key.AlgorithmGroup;
    
        [Benchmark]
        public CngProvider? GetProvider() => _rsa.Key.Provider;
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

GetAlgorithm

.NET 8.0

63,619.352 ns

1.000

88 B

1.00

GetAlgorithm

.NET 9.0

10.216 ns

0.000

–

0.00

GetAlgorithmGroup

.NET 8.0

62,580.363 ns

1.000

88 B

1.00

GetAlgorithmGroup

.NET 9.0

8.354 ns

0.000

–

0.00

GetProvider

.NET 8.0

62,108.489 ns

1.000

232 B

1.00

GetProvider

.NET 9.0

8.393 ns

0.000

–

0.00

There were also several improvements related to loading certificates and keys. [dotnet/runtime#97267](https://github.com/dotnet/runtime/pull/97267) from [@birojnayak](https://github.com/birojnayak) addressed an issue on Linux where the same certificate was being processed multiple times rather than just once, and [dotnet/runtime#97827](https://github.com/dotnet/runtime/pull/97827) improved the performance of RSA key loading by avoiding some unnecessary work that the key validation was performing.

Networking
----------

Quick, when was the last time you worked on a real application or service that didn’t involve networking at all? I’ll wait… (I’m so funny.) Effectively every modern application relies on networking in one way, shape, or form, especially one that’s following more cloud-native architectures, involving microservices, and the like. Driving down the costs associated with networking is something we take very seriously, and the .NET community whittles away at these costs every release, including in .NET 9.

`SslStream` has been a key focus for performance optimization in past releases. It’s used by a significant portion of traffic with both `HttpClient` and the ASP.NET Kestrel web server, putting it on the hot path for many systems. Previous improvements have targeted both steady-state throughput as well as creation overhead.

In .NET 9, a few PRs focused on steady-state throughput, such as [dotnet/runtime#95595](https://github.com/dotnet/runtime/pull/95595), which addressed an issue where some packets were being unnecessarily split into two, leading to extra overhead associated with needing to send and receive that extra packet. This was particularly impactful when writing out exactly 16K, and especially on Windows (where I’ve run this test):

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Net;
    using System.Net.Security;
    using System.Net.Sockets;
    using System.Runtime.InteropServices;
    using System.Security.Authentication;
    using System.Security.Cryptography.X509Certificates;
    using System.Security.Cryptography;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private SslStream _client, _server;
        private byte[] _buffer = new byte[16 * 1024];
        private readonly SslServerAuthenticationOptions _serverOptions = new SslServerAuthenticationOptions
        {
            ServerCertificateContext = SslStreamCertificateContext.Create(GetCertificate(), null),
            EnabledSslProtocols = SslProtocols.Tls13,
        };
        private readonly SslClientAuthenticationOptions _clientOptions = new SslClientAuthenticationOptions
        {
            TargetHost = "localhost",
            RemoteCertificateValidationCallback = delegate { return true; },
            EnabledSslProtocols = SslProtocols.Tls13,
        };
    
        [GlobalSetup]
        public async Task Setup()
        {
            using var listener = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
            listener.Bind(new IPEndPoint(IPAddress.Loopback, 0));
            listener.Listen(1);
    
            var client = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
            client.Connect(listener.LocalEndPoint!);
    
            Socket serverSocket = listener.Accept();
            serverSocket.NoDelay = true;
    
            _client = new SslStream(new NetworkStream(client, ownsSocket: true), leaveInnerStreamOpen: true);
            _server = new SslStream(new NetworkStream(serverSocket, ownsSocket: true), leaveInnerStreamOpen: true);
    
            await Task.WhenAll(
                _client.AuthenticateAsClientAsync(_clientOptions),
                _server.AuthenticateAsServerAsync(_serverOptions));
        }
    
        [GlobalCleanup]
        public void Cleanup()
        {
            _client.Dispose();
            _server.Dispose();
        }
    
        [Benchmark]
        public async Task SendReceive()
        {
            await _client.WriteAsync(_buffer);
            await _server.ReadExactlyAsync(_buffer);
        }
    
        private static X509Certificate2 GetCertificate()
        {
            X509Certificate2 cert;
            using (RSA rsa = RSA.Create())
            {
                var certReq = new CertificateRequest("CN=localhost", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
                certReq.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, false));
                certReq.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(new OidCollection { new Oid("1.3.6.1.5.5.7.3.1") }, false));
                certReq.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature, false));
                cert = certReq.CreateSelfSigned(DateTimeOffset.UtcNow.AddMonths(-1), DateTimeOffset.UtcNow.AddMonths(1));
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    cert = new X509Certificate2(cert.Export(X509ContentType.Pfx));
                }
            }
            return cert;
        }
    }

Method

Runtime

Mean

Ratio

SendReceive

.NET 8.0

43.07 us

1.00

SendReceive

.NET 9.0

29.38 us

0.68

[dotnet/runtime#100513](https://github.com/dotnet/runtime/pull/100513) also reduced the cost of checking `SslStream.IsMutuallyAuthenticated` or `SslStream.LocalCertificate` from a client when a client certificate is being used.

However, the bigger impacts in .NET 9 weren’t on steady-state throughput but rather on TLS connection establishment, aka the handshake. Establishing a TLS connection requires the client and server to engage in a conversation where they agree on details like TLS version, what cipher suite to use, confirm the other is who they say they are, create and exchange dedicated symmetric keys for the communication, and so on. That’s a relatively expensive endeavor. For long-lived connections, that overhead is generally not a big deal, but there are plenty of scenarios where connections are more routinely established and torn down, and for those, we want to drive down the overhead associated with setting up such a connection.

[dotnet/runtime#87874](https://github.com/dotnet/runtime/pull/87874) focused on reducing allocations associated with the TLS handshake, by renting some buffers from `ArrayPool<byte>` rather than always allocating. And [dotnet/runtime#97348](https://github.com/dotnet/runtime/pull/97348) continued the effort by avoiding some unnecessary `SafeHandle` allocation. [dotnet/runtime#103814](https://github.com/dotnet/runtime/pull/103814) also switched a rarely-needed `ConcurrentDictionary<>` in the Linux implementation to be lazily allocated rather than always being allocated as part of the handshake. These changes combine to significantly reduce the allocation incurred as part of setting up TLS:

    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Net;
    using System.Net.Security;
    using System.Net.Sockets;
    using System.Runtime.InteropServices;
    using System.Security.Authentication;
    using System.Security.Cryptography.X509Certificates;
    using System.Security.Cryptography;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private NetworkStream _client, _server;
        private readonly SslServerAuthenticationOptions _serverOptions = new SslServerAuthenticationOptions
        {
            ServerCertificateContext = SslStreamCertificateContext.Create(GetCertificate(), null),
            EnabledSslProtocols = SslProtocols.Tls13,
        };
        private readonly SslClientAuthenticationOptions _clientOptions = new SslClientAuthenticationOptions
        {
            TargetHost = "localhost",
            RemoteCertificateValidationCallback = delegate { return true; },
            EnabledSslProtocols = SslProtocols.Tls13,
        };
    
        [GlobalSetup]
        public void Setup()
        {
            using var listener = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
            listener.Bind(new IPEndPoint(IPAddress.Loopback, 0));
            listener.Listen(1);
    
            var client = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
            client.Connect(listener.LocalEndPoint!);
    
            Socket serverSocket = listener.Accept();
            serverSocket.NoDelay = true;
            _server = new NetworkStream(serverSocket, ownsSocket: true);
            _client = new NetworkStream(client, ownsSocket: true);
        }
    
        [GlobalCleanup]
        public void Cleanup()
        {
            _client.Dispose();
            _server.Dispose();
        }
    
        [Benchmark]
        public async Task Handshake()
        {
            using var client = new SslStream(_client, leaveInnerStreamOpen: true);
            using var server = new SslStream(_server, leaveInnerStreamOpen: true);
    
            await Task.WhenAll(
                client.AuthenticateAsClientAsync(_clientOptions),
                server.AuthenticateAsServerAsync(_serverOptions));
        }
    
        private static X509Certificate2 GetCertificate()
        {
            X509Certificate2 cert;
            using (RSA rsa = RSA.Create())
            {
                var certReq = new CertificateRequest("CN=localhost", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
                certReq.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, false));
                certReq.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(new OidCollection { new Oid("1.3.6.1.5.5.7.3.1") }, false));
                certReq.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature, false));
                cert = certReq.CreateSelfSigned(DateTimeOffset.UtcNow.AddMonths(-1), DateTimeOffset.UtcNow.AddMonths(1));
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    cert = new X509Certificate2(cert.Export(X509ContentType.Pfx));
                }
            }
            return cert;
        }
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

Handshake

.NET 8.0

2.652 ms

1.00

5.03 KB

1.00

Handshake

.NET 9.0

2.581 ms

0.97

3.3 KB

0.66

Of course, while driving down the costs of doing something is good, avoiding that thing altogether is even better. “TLS resumption” is a capability in the TLS protocol where, if a connection is closed and the same client later opens a new connection to the same server, the client may be able to effectively pick up where it left off with the previous TLS connection rather than starting a brand new one from scratch. Support for TLS resumption on Linux was added in .NET 7, but clients using client certificates weren’t supported… now in .NET 9 thanks to [dotnet/runtime#102656](https://github.com/dotnet/runtime/pull/102656), even such clients can benefit from this significant time saver.

TLS resumption is an optimization where information is stored to enable more efficient operation later. In some ways, it’s not unlike pooling in that regard. We frequently talk about pooling as a way to optimize. Often our conversations are around avoiding allocations, where employing a pool is betting that you can be more efficient than the garbage collector. For small, cheap to create objects, that’s often a bad bet. For larger objects, such as for larger arrays, it can be a good bet, which is why `ArrayPool<T>` exists and is used throughout the core libraries for getting temporary buffers (see this [Deep .NET discussion on `ArrayPool`](https://www.youtube.com/watch?v=bw7ljmvbrr0) for more info). But there’s a much more impactful class where pooling is useful, and that’s where the thing being pooled is really expensive to create. Such cases are no longer about memory management, they’re about ammortizing the cost of that creation. And out of all of the pooling done throughout the core libraries, it’s hard to imagine a more impactful case of that then the HTTP connection pool. The objects in this pool represent established connections to an HTTP server, and establishing such connections can be measured in microseconds, or even seconds in certain environments. If such costs had to be paid every single time you were making an HTTP request, it would add huge latency throughout the system. Instead, outgoing HTTP requests try to grab a connection from the connection pool, reusing that connection for the individual request/response, and then putting the connection back into the pool when done.

However, as with any pool, the pool itself has cost. In the case of the HTTP connection pool in a `SocketsHttpHandler` instance, the most important factor impacting performance is how quickly a connection can be rented and returned to the pool, especially when under load. That load aspect is important, because as a shared resource, access to this pool must be synchronized, in order to ensure the correctness of the system: it’d be really bad, for example, if two requests went to rent a connection at the same time and ended up incorrectly being given the same connection to use, concurrently. “Really bad” in such a case could not only be corrupting data, but possibly even sending the wrong data to the wrong server. That obviously needs to be avoided. So, synchronization is used, but that synchronization creates a bottleneck, where under load lots of requests can end up being blocked just waiting to check whether a connection is even available. Over the years we’ve whittled away at that cost, but it gets even lower in .NET 9, in particular for HTTP/1.1 connections (we talk about “the” pool, but in reality connections are only pooled together when they’re interchangeable, so there are actually many groupings of connections, for example with HTTP/1.1 connections separate from HTTP/2 connections or HTTP/3 connections, a separate pool for each endpoint, etc.). [dotnet/runtime#99364](https://github.com/dotnet/runtime/pull/99364) changes the synchronization mechanism from using a pure lock-based scheme to a more opportunistic concurrency scheme that employs a first-layer of lockless synchronization. There’s now still a lock, but for the hot path it’s avoided as long as there are connections in the pool by using a `ConcurrentStack<T>`, such that renting is a `TryPop` and returning is a `Push`. `ConcurrentStack<T>` itself uses a lock-free algorithm, that’s a lot more scalable than a lock. There is an interesting downside to `ConcurrentStack<T>`, which is that the algorithm it employs necessarily involves an allocation per pushed element, and for reasons related to the [“ABA” problem](https://en.wikipedia.org/wiki/ABA_problem), those allocations can’t be pooled. That means that every time a connection is returned to the pool now, there’s a small allocation. However, for an HTTP request/response, even though we’ve significantly reduced it over the years, there’s still a non-trivial amount of allocation that occurs over the lifetime of the operation, so one more tiny one doesn’t break the bank, and it’s worth it for the reduced synchronization overheads. We’ve experimented with other data structures, such as `ConcurrentQueue<T>` (which is able to avoid allocation per `Enqueue` at steady state), but they’ve had other downsides. I expect we’ll continue to push on this in the future, but for now, what’s there now is a nice improvement.

Of course once you’ve got the connection, there’s all of the costs associated with actually making the request and handling the response, and those have been whittled away at as well.

*   **Using vectorized helpers.** [dotnet/runtime#93511](https://github.com/dotnet/runtime/pull/93511) replaces a scalar loop for writing out bytes from an HTTP/1.1 request header, instead using `Ascii.FromUtf16`, which is vectorized. In fact, that vectorization was further improved by [dotnet/runtime#102735](https://github.com/dotnet/runtime/pull/102735), which improved the 256-bit and 512-bit code paths by using better instructions possible due to not having to care about edge cases already weeded out.
*   **Avoiding extra async state machines.** [dotnet/runtime#100205](https://github.com/dotnet/runtime/pull/100205) avoids an extra layer of async state machine that was incurred by most of the HTTP/1.1 response streams; a method was `async` only to accommodate some rare logging being enabled, so the `async` wrapper is now only employed when that logging is enabled.
*   **More caching of very common data.** [dotnet/runtime#100177](https://github.com/dotnet/runtime/pull/100177) removes some more allocation and reduces some overheads by computing and caching some bytes that need to be written out on every request.
*   **Special-casing main use cases.** [dotnet/runtime#102859](https://github.com/dotnet/runtime/pull/102859) and [dotnet/runtime#103008](https://github.com/dotnet/runtime/pull/103008) made `JsonContent` and `StringContent` cheaper by special-casing the vastly most common media types used. [dotnet/runtime#93759](https://github.com/dotnet/runtime/pull/93759) further improved `JsonContent` by reducing the number of `async` frames on the hot path. And [dotnet/runtime#102845](https://github.com/dotnet/runtime/pull/102845) from [@pedrobsaila](https://github.com/pedrobsaila) made `TryAddWithoutValidation` cheaper for multiple values by special-casing the most common case of the input being an `IList<string>`, which enables presizing arrays while also avoiding an enumerator allocation.
*   **More ArrayPool.** [dotnet/runtime#103764](https://github.com/dotnet/runtime/pull/103764) avoided a possibly large `char[]` allocation in the parsing of `Alt-Svc` headers by using `ArrayPool` rather than direct allocation.

While this simple benchmark doesn’t touch on all of these changes, it does highlight that the end-to-end performance of HTTP requests gets cheaper:

    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Net.Sockets;
    using System.Net;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private static readonly Socket s_listener = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
        private static readonly HttpMessageInvoker s_client = new(new SocketsHttpHandler());
        private static Uri? s_uri;
    
        [Benchmark]
        public async Task HttpGet()
        {
            var m = new HttpRequestMessage(HttpMethod.Get, s_uri) { Content = new StringContent("Hello, there! How are you today?") };
            using (HttpResponseMessage r = await s_client.SendAsync(m, default))
            using (Stream s = r.Content.ReadAsStream())
                await s.CopyToAsync(Stream.Null);
        }
    
        [GlobalSetup]
        public void CreateSocketServer()
        {
            s_listener.Bind(new IPEndPoint(IPAddress.Loopback, 0));
            s_listener.Listen(int.MaxValue);
            var ep = (IPEndPoint)s_listener.LocalEndPoint!;
            s_uri = new Uri($"http://{ep.Address}:{ep.Port}/");
    
            Task.Run(async () =>
            {
                while (true)
                {
                    Socket s = await s_listener.AcceptAsync();
                    _ = Task.Run(() =>
                    {
                        using (var ns = new NetworkStream(s, true))
                        {
                            byte[] buffer = new byte[1024];
                            int totalRead = 0;
                            while (true)
                            {
                                int read = ns.Read(buffer, totalRead, buffer.Length - totalRead);
                                if (read == 0) return;
                                totalRead += read;
                                if (buffer.AsSpan(0, totalRead).IndexOf("\r\n\r\n"u8) == -1)
                                {
                                    if (totalRead == buffer.Length) Array.Resize(ref buffer, buffer.Length * 2);
                                    continue;
                                }
    
                                ns.Write("HTTP/1.1 200 OK\r\nDate: Sun, 05 Jul 2020 12:00:00 GMT \r\nServer: Example\r\nContent-Length: 5\r\n\r\nHello"u8);
    
                                totalRead = 0;
                            }
                        }
                    });
                }
            });
        }
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

HttpGet

.NET 8.0

92.42 us

1.00

1.98 KB

1.00

HttpGet

.NET 9.0

77.13 us

0.83

1.8 KB

0.91

Related to HTTP, the `WebUtility` and `HttpUtility` types both got more efficient this release. [dotnet/runtime#103737](https://github.com/dotnet/runtime/pull/103737), in particular, made a variety of changes that have a measurable impact on `HtmlEncode` and `UrlEncode`:

*   `HtmlEncode` had a scalar loop looking for characters that need to be encoded. That loop can instead be vectorized by using `SearchValues<char>`.
*   `UrlEncode` also had a simlar scalar loop as part of looking for the first non-safe character. `SearchValues<char>` can also solve this.
*   `UrlEncode` had a complicated scheme where it would UTF8-encode into a newly-allocated `byte[]`, percent-encode in place in that (thanks to the ability to reinterpret cast with spans), and then use the resulting chars to create a new `string`. Instead, `string.Create` can be used, with all of the work done in-place in the buffer generated for that operation.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Net;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        [Benchmark]
        [Arguments("""
            How much wood could a woodchuck chuck
            If a woodchuck could chuck wood?
            A woodchuck would chuck as much wood
            As much wood as a woodchuck could chuck,
            If a woodchuck could chuck wood.
            """)]
        public string HtmlEncode(string input) => WebUtility.HtmlEncode(input);
    
        [Benchmark]
        [Arguments("short_name.txt")]
        public string UrlEncode(string input) => WebUtility.UrlEncode(input);
    }

Method

Runtime

input

Mean

Ratio

HtmlEncode

.NET 8.0

How (…)ood. \[181\]

102.607 ns

1.00

HtmlEncode

.NET 9.0

How (…)ood. \[181\]

10.188 ns

0.10

UrlEncode

.NET 8.0

short\_name.txt

8.656 ns

1.00

UrlEncode

.NET 9.0

short\_name.txt

2.463 ns

0.28

`HttpUtility` also received some attention. [dotnet/runtime#102805](https://github.com/dotnet/runtime/pull/102805) from [@TrayanZapryanov](https://github.com/TrayanZapryanov) updated `UrlEncodeToBytes`, using stack space instead of allocation for smaller inputs, and using `SearchValues<byte>` to optimize the search for invalid bytes. [dotnet/runtime#102753](https://github.com/dotnet/runtime/pull/102753) from [@TrayanZapryanov](https://github.com/TrayanZapryanov) did the same for `UrlDecodeToBytes`. [dotnet/runtime#102909](https://github.com/dotnet/runtime/pull/102909) from [@TrayanZapryanov](https://github.com/TrayanZapryanov) similarly reduced allocation in `UrlPathEncode`, but via the `ArrayPool`. [dotnet/runtime#102917](https://github.com/dotnet/runtime/pull/102917) from [@TrayanZapryanov](https://github.com/TrayanZapryanov) optimized `JavaScriptStringEncode`, in particular by using `SearchValues`. And [dotnet/runtime#102745](https://github.com/dotnet/runtime/pull/102745) from [@TrayanZapryanov](https://github.com/TrayanZapryanov) optimized `ParseQueryString` by using `stackalloc` instead of array allocation for smaller input lengths and by replacing `string.Substring`s with span slicing.

There were also changes elsewhere in the networking stack that contribute to HTTP use cases. In [dotnet/runtime#98074](https://github.com/dotnet/runtime/pull/98074), for example, `Uri` gained new `TryEscapeDataString` and `TryUnescapeDataString` methods that store the output characters into a provided destination span rather than allocating new strings on each call. These methods were then used elsewhere in the networking stack, such as in `FormUrlEncodedContent`, to improve throughput and reduce allocation.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private KeyValuePair<string, string>[] _data =
        [
            new("key1", "value1"),
            new("key2", "value2"),
            new("key3", "value3"),
            new("key4", "value4")
        ];
    
        [Benchmark]
        public FormUrlEncodedContent Create() => new FormUrlEncodedContent(_data);
    }

Method

Runtime

Mean

Ratio

Allocated

Alloc Ratio

Create

.NET 8.0

311.5 ns

1.00

848 B

1.00

Create

.NET 9.0

218.7 ns

0.70

384 B

0.45

Beyond raw HTTP, there were also some new features for `WebSocket` in .NET 9, namely support for keep-alive pings and timeouts, though not many PRs focused solely on performance (though [dotnet/runtime#101953](https://github.com/dotnet/runtime/pull/101953) from [@PaulusParssinen](https://github.com/PaulusParssinen) did utilize some newer APIs in `ManagedWebSocket` in a way that may have removed a bit of fat). There was one notable improvement, however, in [dotnet/runtime#104865](https://github.com/dotnet/runtime/pull/104865). The web sockets [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455) specification requires that when a data frame’s payload data has an opcode denoting it as text, that text must be checked to be valid UTF8-encoded bytes. The validation for that had been a hand-rolled scalar comparison loop. However, now that `Utf8.IsValid` exists (it was introduced in .NET 8), that accelerated method can be used here instead. It can’t be used in all situations, which is probably why it wasn’t immediately employed when the method was added in the first place. Web sockets payloads may be split across data frames, so it’s possible that the frame being validated is actually the continuation of some previously-received data, and it’s possible that this frame is not the end of the payload, either. But, we know those two pieces of information up-front: if it’s a continuation from a previous frame, we would have already noted it as such, and if it’s not complete, its end-of-message bit won’t have been set. Thus, for the common case where the payload is complete, we can use the accelerated helper for UTF8 validation, and only fall back to the slower path for the corner cases. And this matters because even with the networking costs involved, that UTF8 validation shows up.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Net;
    using System.Net.Sockets;
    using System.Net.WebSockets;
    using System.Text;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private WebSocket _client, _server;
        private Memory<byte> _buffer = Encoding.UTF8.GetBytes("""
            Shall I compare thee to a summer’s day?
            Thou art more lovely and more temperate:
            Rough winds do shake the darling buds of May,
            And summer’s lease hath all too short a date;
            Sometime too hot the eye of heaven shines,
            And often is his gold complexion dimm'd;
            And every fair from fair sometime declines,
            By chance or nature’s changing course untrimm'd;
            But thy eternal summer shall not fade,
            Nor lose possession of that fair thou ow’st;
            Nor shall death brag thou wander’st in his shade,
            When in eternal lines to time thou grow’st:
            So long as men can breathe or eyes can see,
            So long lives this, and this gives life to thee.
            """);
        private Memory<byte> _tmp = new byte[1024];
    
        [GlobalSetup]
        public void Setup()
        {
            using var listener = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
            listener.Bind(new IPEndPoint(IPAddress.Loopback, 0));
            listener.Listen();
    
            var client = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
            client.Connect(listener.LocalEndPoint!);
            Socket server = listener.Accept();
    
            _client = WebSocket.CreateFromStream(new NetworkStream(client, ownsSocket: true), new WebSocketCreationOptions { IsServer = false, });
            _server = WebSocket.CreateFromStream(new NetworkStream(server, ownsSocket: true), new WebSocketCreationOptions { IsServer = true });
        }
    
        [GlobalCleanup]
        public void Cleanup()
        {
            _client.Dispose();
            _server.Dispose();
        }
    
        [Benchmark]
        public async Task SendReceive()
        {
            await _client.SendAsync(_buffer, WebSocketMessageType.Text, true, default);
            while (!(await _server.ReceiveAsync(_tmp, default)).EndOfMessage) ;
        }
    }

Method

Runtime

Mean

Ratio

SendReceive

.NET 8.0

4.093 us

1.00

SendReceive

.NET 9.0

3.438 us

0.84

There are of course a variety of reasons that performance could have improved, e.g. maybe `WebSockets` is just exercising a code path that benefits from one of the other optimizations already discussed. How do we know it’s connected to the validation? Let’s profile. And since we already have a benchmark written, we can just use it. There’s another very handy nuget package, `Microsoft.VisualStudio.DiagnosticsHub.BenchmarkDotNetDiagnosers`, which contains additional “diagnosers” for BenchmarkDotNet. Diagnosers are one of the main extensibility points within BenchmarkDotNet, enabling developers to perform additional tracking and analyses over benchmarks. You’ve already seen me use some, including the built-in `[MemoryDiagnoser(false)]` and `[DisassemblyDiagnoser]`; there are other built-in ones we haven’t used in this post but that are helpful in various situations, like `[ThreadingDiagnoser]` and `[ExceptionDiagnoser]`, but diagnosers can come from anywhere, and the aforementioned nuget package provides several more. The purpose of those diagnosers is to collect and export performance traces that Visual Studio’s performance tools can then consume. In my case, I want to collect a CPU trace, so as to understand where CPU consumption is going, so I added a `[CPUUsageDiagnoser]` attribute to my `Tests` class:

    [CPUUsageDiagnoser]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests

and then re-ran (on Windows). That’s it. While the test is running, you’ll see the same output as you’re used to seeing, plus a little more. For example, at the end of the benchmarking, I now also see this:

    // * Diagnostic Output - VSDiagnosticsDiagnoser *
    Collection result moved to 'BenchmarkDotNet_Tests_20240804_081400.diagsession'.
    Session : {a1671047-d6da-4a56-9c71-eadef6c1dd00}
      Stopped
    Exported diagsession file: d:\Benchmarks\BenchmarkDotNet_Tests_20240804_081400.diagsession.

I then simply opened that `.diagsession` file, just typing its name at the command-line, since that file extension is by default associated with Visual Studio, but you could also File->Open from within Visual Studio itself. That results in a view like the following: ![Benchmark traces in Visual Studio](https://devblogs.microsoft.com/dotnet/wp-content/uploads/sites/10/2024/09/VS_BenchmarkTrace_TestsView.png) Notice this single trace covers both the .NET 8 test execution and the .NET 9 test execution, and each is represented by a different entry in the Benchmarks table (but both are on the same execution timeline). I can then double-click one of the tests to narrow the timeline down to just the relevant portion of activity, and then switch over to the CPU Usage tab. When I do, here’s what I see for .NET 8 for the top impacting methods: ![Top impacting methods in .NET 8 benchmark](https://devblogs.microsoft.com/dotnet/wp-content/uploads/sites/10/2024/09/VS_BenchmarkTrace_Net8.png) and for .NET 9: ![Top impacting methods in .NET 9 benchmark](https://devblogs.microsoft.com/dotnet/wp-content/uploads/sites/10/2024/09/VS_BenchmarkTrace_Net9.png) Notice in the first trace that `TryValidateUtf8` is taking up almost 8% of the CPU time, but it doesn’t show up in the second trace at all, instead being replaced by `Utf8Utility.GetPointerToFirstInvalidByte`, which is the implementation of `Utf8.IsValid` and which is only half a percent. That ~8% correlates with the ~10% reduction we saw in benchmark execution time. Neat.

JSON
----

System.Text.Json hit the scene in .NET Core 3.0, and every release since it’s gotten more capable and more efficient. .NET 9 is no exception. In addition to new features like support for exporting JSON schema, deep semantic equality comparison of `JsonElement`s, the ability to respect nullable reference type annotations, support for ordering JsonObject properties, new contract metadata APIs, and more, performance has also been a significant focus.

One improvement comes from the integration of `JsonSerializer` with `System.IO.Pipelines`. Much of the .NET stack moves bytes around via `Stream`, however ASP.NET internally is implemented with `System.IO.Pipelines`. There are built-in bidirectional adapters between streams and pipes, but in some cases those adapters add some overhead. As JSON is so critical to modern services, it’s important that `JsonSerializer` be able to work equally well with both streams and pipes. As such, [dotnet/runtime#101461](https://github.com/dotnet/runtime/pull/101461) adds new `JsonSerializer.SerializeAsync` overloads that target `PipeWriter` in addition to the existing overloads that target `Stream`. That way, whether you have a `Stream` or a `PipeWriter`, `JsonSerializer` will natively work with either without requiring any indirection to adapt between them. Just use whichever you already have.

`JsonSerializer`‘s handling of enums was also improved by [dotnet/runtime#105032](https://github.com/dotnet/runtime/pull/105032). In addition to adding support for the new `[JsonEnumMemberName]` attribute, it also moved to an allocation-free parsing solution for enums, utilizing the `GetAlternateLookup` support added to `Dictionary<TKey, TValue>` and `ConcurrentDictionary<TKey, TValue>` to enable a cache of enum information queryable via a `ReadOnlySpan<char>`.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Text.Json;
    using System.Reflection;
    using System.Text.Json.Serialization;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private static readonly JsonSerializerOptions s_options = new()
        {
            Converters = { new JsonStringEnumConverter() },
            DictionaryKeyPolicy = JsonNamingPolicy.KebabCaseLower,
        };
    
        [Params(BindingFlags.Default, BindingFlags.NonPublic | BindingFlags.Instance)]
        public BindingFlags _value;
    
        private byte[] _jsonValue;
        private Utf8JsonWriter _writer = new(Stream.Null);
    
        [GlobalSetup]
        public void Setup() => _jsonValue = JsonSerializer.SerializeToUtf8Bytes(_value, s_options);
    
        [Benchmark]
        public void Serialize()
        {
            _writer.Reset();
            JsonSerializer.Serialize(_writer, _value, s_options);
        }
    
        [Benchmark]
        public BindingFlags Deserialize() =>
            JsonSerializer.Deserialize<BindingFlags>(_jsonValue, s_options);
    }

Method

Runtime

\_value

Mean

Ratio

Allocated

Alloc Ratio

Serialize

.NET 8.0

Default

38.67 ns

1.00

24 B

1.00

Serialize

.NET 9.0

Default

27.23 ns

0.70

–

0.00

Deserialize

.NET 8.0

Default

73.86 ns

1.00

–

NA

Deserialize

.NET 9.0

Default

70.48 ns

0.95

–

NA

Serialize

.NET 8.0

Instance, NonPublic

37.60 ns

1.00

24 B

1.00

Serialize

.NET 9.0

Instance, NonPublic

26.82 ns

0.71

–

0.00

Deserialize

.NET 8.0

Instance, NonPublic

97.54 ns

1.00

–

NA

Deserialize

.NET 9.0

Instance, NonPublic

70.72 ns

0.73

–

NA

`JsonSerializer` relies on lots of other functionality from `System.Text.Json`, which has also improved. Here’s a sampling:

*   **Direct use of UTF8.** `JsonProperty.WriteTo` would always use `writer.WritePropertyName(Name)` to output the property name. However, that `Name` property might end up allocating a new `string` if the `JsonProperty` wasn’t already caching one. [dotnet/runtime#90074](https://github.com/dotnet/runtime/pull/90074) from [@karakasa](https://github.com/karakasa) tweaked the implementation to write out the `string` if it already had one, or else to directly write out a name based on the UTF8 bytes it would have used to create that `string`.
*   **Avoiding unnecessary intermediate state.** [dotnet/runtime#97687](https://github.com/dotnet/runtime/pull/97687) from [@habbes](https://github.com/habbes) is one of those lovely PRs that’s a pure win. The primary change here is to a `Base64EncodeAndWrite` method that’s Base64-encoding a source `ReadOnlySpan<byte>` to a destination `Span<byte>`. The implementation was either `stackalloc`‘ing a buffer or renting a buffer, then encoding into that temporary, and then copying the data into a buffer that is guaranteed to be large enough. Why wasn’t it just encoding directly into that destination buffer rather than going through a temporary? Unclear. But thanks to this PR, that intermediate overhead was simply removed. Similarly, [dotnet/runtime#92284](https://github.com/dotnet/runtime/pull/92284) removed some unnecessary intermediate state from `JsonNode.GetPath`. `JsonNode.GetPath` was doing a lot of allocation, creating a `List<string>` of all of the path segments which were then combined in reverse order into a `StringBuilder`. This changes the implementation to extract the path segments in the reverse order in the first place, then building up the resulting path in stack space or an array rented from the `ArrayPool`.
    
        // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        using System.Text.Json.Nodes;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [MemoryDiagnoser(false)]
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            private JsonNode _json = JsonNode.Parse("""
                {
                    "staff": {
                        "Elsa": {
                            "age": 21,
                            "position": "queen"
                        }
                    }
                }
                """)["staff"]["Elsa"]["position"];
        
            [Benchmark]
            public string GetPath() => _json.GetPath();
        }
    
    Method
    
    Runtime
    
    \_value
    
    Mean
    
    Ratio
    
    Allocated
    
    Alloc Ratio
    
    GetPath
    
    .NET 8.0
    
    Default
    
    176.68 ns
    
    1.00
    
    472 B
    
    1.00
    
    GetPath
    
    .NET 9.0
    
    Default
    
    27.23 ns
    
    0.30
    
    64 B
    
    0.14
    
*   **Using existing caches.** `JsonNode.ToString` and `JsonNode.ToJsonString` were allocating a new `PooledByteBufferWriter` and `Utf8JsonWriter`, but the internal `Utf8JsonWriterCache` type already provides support for using cached versions of these same objects. [dotnet/runtime#92358](https://github.com/dotnet/runtime/pull/92358) just updated these `JsonNode` methods to utilize the existing cache.
*   **Pre-sizing collections.** `JsonObject` has a constructor that accepts an enumerable of properties to add to the object. For a lot of properties, as it’s adding properties, the backing store may need to keep growing and growing, incurring the overhead of allocation and copies. [dotnet/runtime#96486](https://github.com/dotnet/runtime/pull/96486) from [@olo-ntaylor](https://github.com/olo-ntaylor) tests to see whether a count can be retrieved from the enumerable, and if it can, it uses that count to pre-size the dictionary.
*   **Allow fast paths to be fast.** `JsonValue` has a niche feature that enables it to wrap an arbitrary .NET object. As `JsonValue` derives from `JsonNode`, `JsonNode` needs to take that capability into account. The current way it does so makes some common operations much more expensive than they’d need to be. [dotnet/runtime#103733](https://github.com/dotnet/runtime/pull/103733) refactors the implementation to optimize for the common cases.
    
        // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        using System.Text.Json;
        using System.Text.Json.Nodes;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            private JsonNode[] _nodes = [42, "I am a string", false, DateTimeOffset.Now];
        
            [Benchmark]
            [Arguments(JsonValueKind.String)]
            public int Count(JsonValueKind kind)
            {
                var count = 0;
                foreach (var node in _nodes)
                {
                    if (node.GetValueKind() == kind)
                    {
                        count++;
                    }
                }
        
                return count;
            }
        }
    
    Method
    
    Runtime
    
    kind
    
    Mean
    
    Ratio
    
    Count
    
    .NET 8.0
    
    String
    
    729.26 ns
    
    1.00
    
    Count
    
    .NET 9.0
    
    String
    
    12.14 ns
    
    0.02
    
*   **Deduplicating accesses.** `JsonValue.CreateFromElement` accesses `JsonElement.ValueKind` to determine how to process the data, e.g.
    
        if (element.ValueKind is JsonValueKind.Null) { ... }
        else if (element.ValueKind is JsonValueKind.Object or JsonValueKind.Array) { ... }
        else { ... }
    
    If `ValueKind` were a simple field access, that’d be fine. But it’s a bit more complicated than that, involving a large `switch` to determine what kind to return. Rather than possibly reading from it twice, [dotnet/runtime#104108](https://github.com/dotnet/runtime/pull/104108) from [@andrewjsaid](https://github.com/andrewjsaid) just makes a small tweak to only access the property once. No point in doing that work twice.
    
*   **Spans over existing data.** The `JsonElement.GetRawText` method is useful for extracting the original input backing the `JsonElement`, but the data is stored as UTF8 bytes and `GetRawText` returns a `string`, so every call allocates and transcodes to produce the result. From [dotnet/runtime#104595](https://github.com/dotnet/runtime/pull/104595), the new `JsonMarshal.GetRawUtf8Value` simply returns a span over the original data, no encoding, no allocation.
    
        // dotnet run -c Release -f net9.0 --filter "*"
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        using System.Runtime.InteropServices;
        using System.Text.Json;
        using System.Text.Json.Nodes;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [MemoryDiagnoser(false)]
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            private JsonElement _json = JsonSerializer.Deserialize("""
                {
                    "staff": {
                        "Elsa": {
                            "age": 21,
                            "position": "queen"
                        }
                    }
                }
                """);
        
            [Benchmark(Baseline = true)]
            public string GetRawText() => _json.GetRawText();
        
            [Benchmark]
            public ReadOnlySpan<byte> TryGetRawText() => JsonMarshal.GetRawUtf8Value(_json);
        }
    
    Method
    
    Mean
    
    Ratio
    
    Allocated
    
    Alloc Ratio
    
    GetRawText
    
    51.627 ns
    
    1.00
    
    192 B
    
    1.00
    
    TryGetRawText
    
    7.998 ns
    
    0.15
    
    –
    
    0.00
    
    Note that the new method is on the new `JsonMarshal` class because it’s an API with safety concerns (in general, APIs on the `Unsafe` class or in the `System.Runtime.InteropServices` namespace are considered “unsafe”). The concern here is that the `JsonElement` might be backed by an array rented from the `ArrayPool`, if the `JsonElement` came from a `JsonDocument`. The `ReadOnlySpan<byte>` you get back is simply pointing into that array. If after getting the span, the `JsonDocument` is disposed, it’ll return that array back to the pool, and now the span is referencing an array that someone else might rent. If they do and write into that array, the span will now contain whatever was written there, effectively yielding corrupted data. Try this:
    
        // dotnet run -c Release -f net9.0
        
        using System.Runtime.InteropServices;
        using System.Text.Json;
        using System.Text;
        
        ReadOnlySpan<byte> elsaUtf8;
        using (JsonDocument elsaJson = JsonDocument.Parse("""
                {
                  "staff": {
                    "Elsa": {
                      "age": 21,
                      "position": "queen"
                    }
                  }
                }
                """))
        {
            elsaUtf8 = JsonMarshal.GetRawUtf8Value(elsaJson.RootElement);
        }
        
        using (JsonDocument annaJson = JsonDocument.Parse("""
                {
                  "staff": {
                    "Anna": {
                      "age": 18,
                      "position": "princess"
                    }
                  }
                }
                """))
        {
            Console.WriteLine(Encoding.UTF8.GetString(elsaUtf8)); // uh oh!
        }
    
    When I run that, it prints out the information about “Anna,” even though I retrieved the raw text from the “Elsa” `JsonElement`. Oops! As with anything in C# or .NET that’s “unsafe,” you just need to make sure you hold it correctly.
    

One last improvement I want to call out. The feature itself is not actually about performance, but the workarounds I’ve seen folks employ for the lack of this capability do have a significant performance impact, and so having the feature built-in will be a net performance win. [dotnet/runtime#104328](https://github.com/dotnet/runtime/pull/104328) adds support to both `Utf8JsonReader` and `JsonSerializer` for parsing out multiple top-level JSON objects from an input. Previously if any data was found after a JSON object in the input, that would be considered erroneous and fail to parse, and that means that if a particular data source served up multiple JSON objects one after the other, the data would need to be pre-parsed in order to feed only the relevant portions to `System.Text.Json`. This is particularly relevant with services that stream data, as some of them use such a format.

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Text.Json;
    using System.Text.Json.Nodes;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [MemoryDiagnoser(false)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private MemoryStream _source = new MemoryStream("""
            {
              "name": "Alice",
              "age": 30,
              "city": "New York"
            }
    
            {
              "name": "Bob",
              "age": 25,
              "city": "Los Angeles"
            }
    
            {
              "name": "Charlie",
              "age": 35,
              "city": "Chicago"
            }
            """u8.ToArray());
    
        [Benchmark]
        [Arguments("Dave")]
        public async Task<Person?> FindAsync(string name)
        {
            _source.Position = 0;
    
            await foreach (var p in JsonSerializer.DeserializeAsyncEnumerable<Person>(_source, topLevelValues: true))
            {
                if (p?.Name == name)
                {
                    return p;
                }
            }
    
            return null;
        }
    
        public class Person
        {
            public string Name { get; set; }
            public int Age { get; set; }
            public string City { get; set; }
        }
    }

Diagnostics
-----------

Being able to observe one’s application in production is critical to the operation of modern services. `System.Diagnostics.Metrics.Meter` is .NET’s recommended type for emitting metrics, and several improvements have gone into making it more efficient in .NET 9.

`Counter` and `UpDownCounter` are often used for hot-path tracking of metrics like number of active or queued requests. In production environments, these instruments are frequently bombarded from multiple threads concurrently, which both means they need to be thread-safe but also that they need to be able to scale well. The thread-safety had been achieved by using a `lock` around updates (which were simply reading a value, adding to it, and storing it back), but under heavy load that could result in significant contention on the lock. To address this, [dotnet/runtime#91566](https://github.com/dotnet/runtime/pull/91566) changed the implementation in a few ways. First, rather than using a `lock` to protect the state:

    lock (this)
    {
        _delta += value;
    }

it used an interlocked operation to perform the addition atomically. Here `_delta` is a `double`, and there’s no `Interlocked.Add` that works with `double` values, so instead the standard approach of using a loop around an `Interlocked.CompareExchange` was employed.

    double currentValue;
    do
    {
        currentValue = _delta;
    }
    while (Interlocked.CompareExchange(ref _delta, currentValue + value, currentValue) != currentValue);

That helps, but while this does reduce the overhead and improve scalability, it still represents a bottleneck under heavy contention. To address that, the change also split the single `_delta` into an array of values, one per core, and a thread picks one of them to update, typically the value associated with the core on which it’s currently running. That way, contention is significantly reduced as it’s both distributed across N values instead of 1 value, and because threads prefer the value for the core on which they’re on, and because there’s only ever one thread executing on a specific core at a given moment, chances for conflicts are significantly reduced. There is still some contention, both because a thread isn’t guaranteed to use the associated value (e.g. the thread could migrate between the time it checks what core it’s on and does the access) and because we actually cap the size of the array (so that it doesn’t consume too much memory), but it still makes the system much more scalable.

    // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Diagnostics.Metrics;
    using System.Diagnostics.Tracing;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private MetricsEventListener _listener = new MetricsEventListener();
        private Meter _meter = new Meter("Example");
        private Counter<int> _counter;
    
        [GlobalSetup]
        public void Setup() => _counter = _meter.CreateCounter<int>("counter");
    
        [GlobalCleanup]
        public void Cleanup()
        {
            _listener.Dispose();
            _meter.Dispose();
        }
    
        [Benchmark]
        public void Counter_Parallel()
        {
            Parallel.For(0, 1_000_000, i =>
            {
                _counter.Add(1);
                _counter.Add(1);
            });
        }
    
        private sealed class MetricsEventListener : EventListener
        {
            protected override void OnEventSourceCreated(EventSource eventSource)
            {
                if (eventSource.Name == "System.Diagnostics.Metrics")
                {
                    EnableEvents(eventSource, EventLevel.LogAlways, EventKeywords.All, new Dictionary<string, string?>() { { "Metrics", "Example\\upDownCounter;Example\\counter" } });
                }
            }
        }
    }

Method

Runtime

Mean

Ratio

Counter\_Parallel

.NET 8.0

137.90 ms

1.00

Counter\_Parallel

.NET 9.0

30.65 ms

0.22

There’s another interesting aspect of the improvement worth mentioning, and that’s the padding employed in the array. Going from a single `double _delta` to an array of deltas, you might imagine we’d end up with:

    private readonly double[] _deltas;

but if you look at the code, it’s instead:

    private readonly PaddedDouble[] _deltas;

where `PaddedDouble` is defined as:

    [StructLayout(LayoutKind.Explicit, Size = 64)]
    private struct PaddedDouble
    {
        [FieldOffset(0)]
        public double Value;
    }

This effectively increases the size of each value from 8 bytes to 64 bytes, where only the first 8 bytes of each value is used and the other 56 bytes are padding. That’s odd, right? Normally we’d jump at an opportunity to shrink 64 bytes down to 8 bytes in order to reduce allocation and memory consumption, but here we’re purposefully going in the other direction.

The reason for that is “false sharing.” Consider this benchmark, which I’ve shamelessly borrowed from a conversation Scott Hanselman and I recently had in [Let’s Talk Parallel Programming](https://www.youtube.com/watch?v=18w4QOWGJso) in the [Deep .NET series](https://www.youtube.com/playlist?list=PLdo4fOcmZ0oX8eqDkSw4hH9cSehrGgdr1):

    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private int[] _values = new int[32];
    
        [Params(1, 31)]
        public int Index { get; set; }
    
        [Benchmark]
        public void ParallelIncrement()
        {
            Parallel.Invoke(
                () => IncrementLoop(ref _values[0]),
                () => IncrementLoop(ref _values[Index]));
    
            static void IncrementLoop(ref int value)
            {
                for (int i = 0; i < 100_000_000; i++)
                {
                    Interlocked.Increment(ref value);
                }
            }
        }
    }

When I run that, I get results like this:

Method

Index

Mean

ParallelIncrement

1

1,779.9 ms

ParallelIncrement

31

432.3 ms

In this benchmark, one thread is incrementing `_values[0]` and the other thread is incrementing either `_values[1]` or `_values[31]`. That index is the only difference, yet the one accessing `_values[31]` is several times faster than the one accessing `_values[1]`. That’s because there’s contention here even if it’s not obvious in the code. The contention comes from the fact that the hardware works with memory in groups of bytes called a “cache line.” Most hardware has caches lines of 64 bytes. In order to update a particular memory location, the hardware will acquire the whole cache line. If another core wants to update that same cache line, it’ll need to acquire it. That back and forth results in a lot of overhead. It doesn’t matter if one core is touching the first of those 64 bytes and another thread is touching the last, from the hardware’s perspective there’s still sharing happening. “False sharing.” Thus, the `Counter` fix is using padding around the `double` values to try to space them out more so as to minimize the sharing that limits scalability.

As an aside, there are some additional BenchmarkDotNet diagnosers that can help to highlight the effects of false sharing. ETW on Windows enables collecting various CPU performances counters, such as for branch misses or instructions retired, and BenchmarkDotNet has a `[HardwareCounters]` diagnoser that’s able to collect this ETW data. One such counter is for cache misses, which often reflect false sharing issues. If you’re on Windows, you can try grabbing the separate `BenchmarkDotNet.Diagnostics.Windows` nuget package and using it as in this benchmark:

    // This benchmark only works on Windows.
    // Add a <PackageReference Include="BenchmarkDotNet.Diagnostics.Windows" Version="0.14.0" /> to the csproj.
    // dotnet run -c Release -f net9.0 --filter "*"
    
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Diagnosers;
    using BenchmarkDotNet.Running;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HardwareCounters(HardwareCounter.InstructionRetired, HardwareCounter.CacheMisses)]
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private int[] _values = new int[32];
    
        [Params(1, 31)]
        public int Index { get; set; }
    
        [Benchmark]
        public void ParallelIncrement()
        {
            Parallel.Invoke(
                () => IncrementLoop(ref _values[0]),
                () => IncrementLoop(ref _values[Index]));
    
            static void IncrementLoop(ref int value)
            {
                for (int i = 0; i < 100_000_000; i++)
                {
                    Interlocked.Increment(ref value);
                }
            }
        }
    }

Here I’ve asked for both instructions retired, which reflects how much instructions were fully executed (this in and of itself can be a useful metric when analyzing performance, as it’s not as prone to variation as wall-clock measurements), and cache misses, which reflects how many times data wasn’t available in the CPU’s cache.

Method

Index

Mean

InstructionRetired/Op

CacheMisses/Op

ParallelIncrement

1

1,846.2 ms

804,300,000

177,889

ParallelIncrement

31

442.5 ms

824,333,333

52,429

In the two benchmarks, we can see that the number of instructions executed is almost the same between when false sharing occurred (Index == 1) and didn’t (Index == 31), but the number of cache misses is more than three times larger in the false sharing case, and reasonably well correlated with the time increase. When one core performs a write, that invalidates the corresponding cache line in the other core’s cache, such that the other core then needs to reload the cache line, resulting in cache misses. But I digress…

Another nice improvement comes in [dotnet/runtime#105011](https://github.com/dotnet/runtime/pull/105011) from [@stevejgordon](https://github.com/stevejgordon), adding a new constructor to `Measurement`. Often when creating `Measurement`s, you’re also tagging them with additional key/value pairs of information, for which the `TagList` type exists. `TagList` implements `IList<KeyValuePair<string, object?>>`, and `Measurement` has a constructor that takes an `IEnumerable<KeyValuePair<string, object?>>`, so you can pass a `TagList` to a `Measurement` and it “just works”… albeit slower than it could. If you had code like:

    measurements.Add(new Measurement<long>(
        snapshotV4.LastAckCount,
        new TagList { tcpVersionFourTag, new(NetworkStateKey, "last_ack") }));

that would end up boxing the `TagList` struct as an enumerable, and then enumerating through it via the interface, which also entails an enumerator allocation. The new constructor this PR adds takes a `TagList`, avoiding those overheads. `TagList` is also a large struct, as common usage has it living only on the stack and so as an optimization it stores some of the contained key/value pairs directly in fields on the struct rather than always forcing an array allocation. The net result is much less overhead in constructing these measurements.

`TagList` itself was also improved by [dotnet/runtime#104132](https://github.com/dotnet/runtime/pull/104132), which re-implemented the type for .NET 8+ on top of `[InlineArray]`. `TagList` is effectively a list of key/value pairs, but in order to avoid always allocating a backing store, it stores some of those pairs inline in itself. This previously was done with dedicated fields for each pair, and then code that directly accessed each field. Now, an `[InlineArray]` is used, cleaning up the code and enabling access via spans.

    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Running;
    using System.Diagnostics;
    using System.Diagnostics.Metrics;
    
    BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
    
    [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
    public class Tests
    {
        private Counter<long> _counter;
        private Meter _meter;
    
        [GlobalSetup]
        public void Setup()
        {
            this._meter = new Meter("TestMeter");
            this._counter = this._meter.CreateCounter<long>("counter");
        }
    
        [GlobalCleanup]
        public void Cleanup() => this._meter.Dispose();
    
        [Benchmark]
        public void CounterAdd()
        {
            this._counter?.Add(100, new TagList
            {
                { "Name1", "Val1" },
                { "Name2", "Val2" },
                { "Name3", "Val3" },
                { "Name4", "Val4" },
                { "Name5", "Val5" },
                { "Name6", "Val6" },
                { "Name7", "Val7" },
            });
        }
    }

Method

Runtime

Mean

Ratio

CounterAdd

.NET 8.0

31.88 ns

1.00

CounterAdd

.NET 9.0

13.93 ns

0.44

Peanut Butter
-------------

Throughout this post, I’ve tried to group improvements by topic area in order to create a more fluid and interesting discussion. However, over the course of a year, with as vibrant a community as exists for .NET, and with the breadth of functionality that exists across the platform, there are invariably a large number of one-off PRs that improve this or that by a little. It’s often challenging to imagine any one of these significantly “moving the needle,” but altogether, such changes reduce the “peanut butter” of performance overhead spread thinly across the libraries. In no particular order, here’s a non-comprehensive look at some of these:

*   **StreamWriter.Null.** `StreamWriter` exposes a static `Null` field. It stores a `StreamWriter` instance that’s intended to be a “bit bucket,” a sink you can write to that just ignores all of the data, ala `/dev/null` on Unix, `Stream.Null`, and so on. Unfortunately, the way it was implemented had two problems, one of which I’m incredibly surprised took us this long to discover (as it’s been this way for as long as .NET has existed). It was implemented as `new StreamWriter(Stream.Null, ...)`. All of the state tracking done in `StreamWriter` is not thread-safe, yet here this instance is exposed from a public static member, which means it should be thread-safe, and if multiple threads hammered that `StreamWriter` instance, it could result in really strange exceptions occurring, like arithmetic overflow. Performance-wise, it’s also problematic, because even though actual writes to the underlying `Stream` are ignored, all of the work actually done by `StreamWriter` is still done, even though it’s useless. [dotnet/runtime#98473](https://github.com/dotnet/runtime/pull/98473) fixes both of those problems by creating an internal `NullStreamWriter : StreamWriter` type that overrides everything to be nops, and then `Null` is initialized to an instance of that.
    
        // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            [Benchmark]
            public void WriteLine() => StreamWriter.Null.WriteLine("Hello, world!");
        }
        
    
    Method
    
    Runtime
    
    Mean
    
    Ratio
    
    WriteLine
    
    .NET 8.0
    
    7.5164 ns
    
    1.00
    
    WriteLine
    
    .NET 9.0
    
    0.0283 ns
    
    0.004
    
*   **NonCryptographicHashAlgorithm.Append{Async}** `NonCryptographicHashAlgorithm` is the base class in `System.IO.Hashing` for types like `XxHash3` and `Crc32`. One nice feature it provides is the ability to append an entire `Stream`‘s contents to it in a single call, e.g.
    
        
        XxHash3 hash = new();
        hash.Append(someStream);
        
    
    The implementation of `Append` was fairly straightforward: rent a buffer from the `ArrayPool` and then in a loop repeatedly `Stream.Read` (or `Stream.ReadAsync` in the case of `AppendAsync`) into that buffer and `Append` that filled portion of the buffer. This has a couple of performance downsides, however. First, the buffer being rented was 4096 bytes. That’s not tiny, but using a larger buffer can reduce the number of calls to the source stream being appended, which in turn can reduce any I/O performed by that `Stream`. Second, many streams have optimized implementations for pushing all of their contents to a sink like this: `CopyTo`. `MemoryStream.CopyTo`, for example, will just perform a single write of its entire internal buffer to the `Stream` passed to its `CopyTo`. But even if a `Stream` doesn’t override `CopyTo`, the base `CopyTo` implementation already provides such a copying loop, and it does so by default using a much larger rented buffer. As such, [dotnet/runtime#103669](https://github.com/dotnet/runtime/pull/103669) changes the implementation of `Append` to allocate a small temporary `Stream` object that wraps this `NonCryptographicHashAlgorithm` instance, and any calls to `Write` are just translated to be calls to `Append`. This is a neat example where sometimes we actually choose to pay for a small, short-lived allocation in exchange for significant throughput benefits.
    
        // dotnet run -c Release -f net8.0 --filter "*"
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Configs;
        using BenchmarkDotNet.Environments;
        using BenchmarkDotNet.Jobs;
        using BenchmarkDotNet.Running;
        using System.IO.Hashing;
        
        var config = DefaultConfig.Instance
            .AddJob(Job.Default.WithRuntime(CoreRuntime.Core80).WithNuGet("System.IO.Hashing", "8.0.0").AsBaseline())
            .AddJob(Job.Default.WithRuntime(CoreRuntime.Core90).WithNuGet("System.IO.Hashing", "9.0.0-rc.1.24431.7"));
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args, config);
        
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD", "NuGetReferences")]
        public class Tests
        {
            private Stream _stream;
            private byte[] _bytes;
        
            [GlobalSetup]
            public void Setup()
            {
                _bytes = new byte[1024 * 1024];
                new Random(42).NextBytes(_bytes);
        
                string path = Path.GetRandomFileName();
                File.WriteAllBytes(path, _bytes);
                _stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 0, FileOptions.DeleteOnClose);
            }
        
            [GlobalCleanup]
            public void Cleanup() => _stream.Dispose();
        
            [Benchmark]
            public ulong Hash()
            {
                _stream.Position = 0;
                var hash = new XxHash3();
                hash.Append(_stream);
                return hash.GetCurrentHashAsUInt64();
            }
        }
    
    Method
    
    Runtime
    
    Mean
    
    Hash
    
    .NET 8.0
    
    91.60 us
    
    Hash
    
    .NET 9.0
    
    61.26 us
    
*   **Unnecessary virtual.** `virtual` methods have overhead. First, they’re more expensive to invoke than non-`virtual` methods because it requires several indirections to find the actual target method to invoke (the actual target may differ based on the concrete type being used). And second, without a technology like dynamic PGO, `virtual` methods won’t be inlined, because the compiler can’t statically see which target should be inlined (and even if dynamic PGO makes such inlining possible for the most common type, there’s still a check required to ensure it’s ok to follow that path). As such, if things don’t _need_ to be `virtual`, it’s better performance-wise for them to not be. And if such things are `internal`, unless they’re actively being overridden by something, there’s no reason to keep them `virtual`. [dotnet/runtime#104453](https://github.com/dotnet/runtime/pull/104453) from [@xtqqczze](https://github.com/xtqqczze), [dotnet/runtime#104456](https://github.com/dotnet/runtime/pull/104456) from [@xtqqczze](https://github.com/xtqqczze), and [dotnet/runtime#104483](https://github.com/dotnet/runtime/pull/104483) from [@xtqqczze](https://github.com/xtqqczze) all address exactly such cases, removing `virtual` from a smattering of `internal` members that weren’t being overridden. It might only save a few instructions here and there, but there’s effectively no downside to such a change (other than some minimal code churn), a pure win.
*   **ReadOnlySpan vs Span.** We as developers like to protect ourselves from ourselves, for example making fields `readonly` to avoid accidentally changing them. Such changes can also have performance benefits, for example the JIT can better optimize static fields that are `readonly` than those that aren’t. The same set of principles applies to `Span<T>` and `ReadOnlySpan<T>`. If a method doesn’t need to mutate the contents of a collection being passed in, it’s less accident prone to use a `ReadOnlySpan<T>` rather than a `Span<T>`. It also signals to the caller that they don’t need to be concerned about the data changing out from under them. Interestingly, here, too, there’s both a correctness and a performance benefit to using `ReadOnlySpan<T>` instead of `Span<T>`. The implementations of these two types is almost word-for-word identical, the critical difference being whether the indexer returns a `ref T` or a `ref readonly T`. There is one additional line in `Span<T>`, however, that doesn’t exist in `ReadOnlySpan<T>`. `Span<T>`‘s constructor has this one extra check:
    
        if (!typeof(T).IsValueType && array.GetType() != typeof(T[]))
            ThrowHelper.ThrowArrayTypeMismatchException();
    
    This check exists because of array covariance. Let’s say you have this:
    
        Base[] array = new Derived[3];
        
        class Base { }
        class Derived : Base { }
    
    That code compiles and runs successfully, because .NET supports array covariance, meaning an array of a derived type can be used as an array as the base type. But there’s an important catch here. Let’s augment the example slightly:
    
        Base[] array = new Derived[3];
        array[0] = new AlsoDerived(); // uh oh!
        
        class Base { }
        class Derived : Base { }
        class AlsoDerived : Base { }
    
    This will compile successfully, but at run-time it’ll fail with an `ArrayTypeMismatchException`. That’s because it’s trying to store an `AlsoDerived` instance into a `Derived[]`, and there’s no relationship between the two types that should permit that. The check required to enforce that comes at a cost, every single time you try to write into an array (except in cases where the compiler can prove it’s safe and elide the costs). When `Span<T>` was introduced, the decision was made to hoist that check up to the span’s constructor; that way, once you get a valid span, no such checking needs to be performed on every write, only once on construction. That’s what that additional line of code is doing, checking to ensure that the specified `T` is the same as the provided array’s element type. That means code like this will also throw an `ArrayTypeMismatchException`:
    
        Span<Object> span = new string[2]; // uh oh
    
    But that also means if you use `Span<T>` in situations where you could have used `ReadOnlySpan<T>`, there’s a good chance you’re unnecessarily incurring that check, which means you’re both possibly going to hit unexpected exceptions depending on what arrays are passed in, and you’re incurring a bit of peanut butter cost. [dotnet/runtime#104864](https://github.com/dotnet/runtime/pull/104864) replaced a bunch of `Span<T>`s with `ReadOnlySpan<T>`s to reduce the chances we’d incur such overhead, while also just improving the maintainability of the code.
    
*   **readonly and const.** In the same vein, changing fields that could be `const` to be so, changing non-`readonly` fields that could be `readonly` to be so, and removing unnecessary property setters is all goodness for maintainability while also having the chance of improving performance. Making fields `const` avoids unnecessary memory accesses while also allowing the JIT to better employ constant propagation. And making static fields `readonly` enables the JIT to treat them as if they were `const` in tier 1 compilation. [dotnet/runtime#100728](https://github.com/dotnet/runtime/pull/100728) updates hundreds of occurrences.
*   **MemoryCache.** [dotnet/runtime#103992](https://github.com/dotnet/runtime/pull/103992) from [@ADNewsom09](https://github.com/ADNewsom09) addresses an inefficiency in `Microsoft.Extensions.Caching.Memory`. If multiple concurrent operations end up triggering the cache’s compaction operation, many of the involved threads can all end up duplicating each other’s work. The fix is to simply have only one of the threads do the compaction operation.
*   **BinaryReader.** [dotnet/runtime#80331](https://github.com/dotnet/runtime/pull/80331) from [@teo-tsirpanis](https://github.com/teo-tsirpanis) made `BinaryReader` allocations relevant only to reading text be lazily allocated only when such reading occurs. If the reader is never used for reading text, the application won’t need to pay for the allocation.
*   **ArrayBufferWriter.** [dotnet/runtime#88009](https://github.com/dotnet/runtime/pull/88009) from [@AlexRadch](https://github.com/AlexRadch) adds a new `ResetWrittenCount` method to `ArrayBufferWriter`. `ArrayBufferWriter.Clear` already exists, but in addition to setting the written count to 0, it also clears the underlying buffer. In many situations, that clearing is unnecessary overhead, so `ResetWrittenCount` allows it to be avoided. (There was an interesting debate about whether such a new method is even necessary, and whether `Clear` could just be changed to remove the zeroing. But concerns about stale data finding their way into consuming code as corrupted data led to the new method being added instead.)
*   **Span-based File methods.** The static `File` class provides simple helpers for interacting with files, e.g. `File.WriteAllText`. Historically, these methods have worked with strings and arrays. That means, though, that if someone instead has a span, they either can’t use these simple helpers or they need to pay to create a string or an array from the span. [dotnet/runtime#103308](https://github.com/dotnet/runtime/pull/103308) adds new span-based overloads so that developers don’t need to choose here between simplicity and performance.
*   **string concat vs Append.** string concatenation inside of a loop is well-known no-no, as in the extreme it can lead to significant `O(N^2)` costs. Such a string concatenation was occurring, however, inside of `MailAddressCollection`, where an encoded version of every address in the collection was being appended onto a string using string concatenation. [dotnet/runtime#95760](https://github.com/dotnet/runtime/pull/95760) from [@YohDeadfall](https://github.com/YohDeadfall) changed that to use a builder instead.
*   **Closures.** The config source generator was introduced in .NET 8 to significantly improve the performance of configuration binding, while also making it friendlier to Native AOT. It achieved both. However, it can be improved further. There’s an unanticipated extra allocation that occurs on success paths that’s only relevant to failure paths, because of how the code is being generated. For a call site like this:
    
        public static void M(IConfiguration configuration, C1 c) => configuration.Bind(c);
    
    the source generator would emit a method like this:
    
        public static void BindCore(IConfiguration configuration, ref C1 obj, BinderOptions? binderOptions)
        {
            ValidateConfigurationKeys(typeof(C1), s_configKeys_C1, configuration, binderOptions);
            if (configuration["Value"] is string value15)
                obj.Value = ParseInt(value15, () => configuration.GetSection("Value").Path);
        }
    
    That lambda being passed to the `ParseInt` helper is accessing `configuration`, which is defined outside of the lambda as a parameter. To get that data into the lambda, the compiler allocates a “display class” to store the information, with the body of the lambda translated into a method on that display class. That display class gets allocated at the beginning of the scope that contains the data, which in this case means it’s allocated at the beginning of the `BindCore` method. That means it’s allocated regardless of whether the `if` block is true, and even if `ParseInt` is called, the delegate passed to it is only ever invoked when there’s a failure. [dotnet/runtime#100257](https://github.com/dotnet/runtime/pull/100257) from [@pedrobsaila](https://github.com/pedrobsaila) reworks the source generator code so that this allocation isn’t incurred.
    
*   **Stream.Read/Write Span Overrides.** `Stream`s that don’t override the span-based `Read`/`Write` methods end up utilizing the base implementations, which allocate. There are a ton of `Stream` implementations in dotnet/runtime, and we’ve overridden such methods almost everywhere, but now and again we find one that slipped through. [dotnet/runtime#86674](https://github.com/dotnet/runtime/pull/86674) from [@hrrrrustic](https://github.com/hrrrrustic) fixed one such case on the `StreamOnSqlBytes` type.
*   **Globalization Arrays.** Every `NumberFormatInfo` object defaults its `NumberGroupSizes`, `CurrentGroupSizes`, and `PercentGroupSizes` to each be new instances of `new int[] { 3 }` (even if subsequent initialization overwrites them). And yet these arrays are never handed out to consumers: the properties that expose them make defensive copies. Which means all of these can just refer to the same shared singleton array. The same is true for `NativeDigits`, which is initialized first to a new array of the numbers `0` through `9`. [dotnet/runtime#93117](https://github.com/dotnet/runtime/pull/93117) addresses all of these by creating and using such singletons.
*   **ColorTranslator.ToWin32.** There’s a [.NET design guideline](https://learn.microsoft.com/dotnet/standard/design-guidelines/property) that says properties should be like smarter fields. The resulting expectation is that they should be cheap, like just accessing a field or doing a very simple calculation over a field. Unfortunately, we don’t always follow our own guidance, and there exist some properties that really, really look like they should be trivial but are actually sometimes not. `System.Drawing.Color` is a good example. A very reasonable mental model for `Color` (which according to the docs “Represents an ARGB (alpha, red, green, blue) color”) is that it’d just be four byte values, one for each channel, either in their own fields or packed together into an `int`. Unfortunately, it’s not quite as simple as that. `Color` _can_ be that, such as if it’s constructed using `Color.FromArgb(uint)`, but it can also be used to represent a “known colors,” as is evident by the `SystemColors` type having a bunch of static properties (e.g. `SystemColors.Control`) that return a color for the underlying OS. And even there, you might think “oh, ok, well those properties must be what Stephen is referring to, they must call out to the OS to get the color, they probably do so and then use `FromArgb`.” And again, that’s a very intuitive mental model, and again it’s not what actually happens. Those properties actually are cheap; all they do is construct a `Color` with an enum value corresponding to the system color. Then where is the actual OS color value retrieved, you ask? As part of the `R`, `G`, `B`, and `A` properties on `Color`!. That means if you access each of these properties, as `ColorTranslator` was doing in a variety of its methods, you’re making three or four times as many P/Invokes as you’d otherwise need to. [dotnet/runtime#106042](https://github.com/dotnet/runtime/pull/106042) fixes this for `ColorTranslator`, but it serves as a good reminder why such guidelines exist. (This benchmark is Windows-specific as `SystemColor` doesn’t currently rely on OS information for Linux or macOS.)
    
        // Windows-specific (it works on Linux and macOS, but doesn't demonstrate the same thing.)
        // dotnet run -c Release -f net8.0 --filter "*" --runtimes net8.0 net9.0
        
        using BenchmarkDotNet.Attributes;
        using BenchmarkDotNet.Running;
        using System.Drawing;
        
        BenchmarkSwitcher.FromAssembly(typeof(Tests).Assembly).Run(args);
        
        [MemoryDiagnoser(false)]
        [HideColumns("Job", "Error", "StdDev", "Median", "RatioSD")]
        public class Tests
        {
            private Color _color = SystemColors.Control;
        
            [Benchmark]
            public int ColorToWin32() => ColorTranslator.ToWin32(_color);
        }
    
    Method
    
    Runtime
    
    Mean
    
    Ratio
    
    ColorToWin32
    
    .NET 8.0
    
    11.263 ns
    
    1.00
    
    ColorToWin32
    
    .NET 9.0
    
    4.711 ns
    
    0.42
    

What’s Next?
------------

Maybe one more poem? An acrostic this time:

    Driving innovation with unmatched speed, 
    Opening doors to what developers need.
    Turbocharged perf, breaking the mold,
    New benchmarks surpassed, metrics so bold.
    Empowering coders, dreams take flight,
    Transforming visions with .NET might.
    
    Navigating challenges with precision and flair,
    Inspiring creativity, improvements everywhere.
    Nurturing growth, pushing limits high,
    Elevating success, reaching for the sky.

Several hundred pages later and still not a poet. Oh well.

I’m asked from time to time why I invest in writing these “Performance Improvements in .NET” posts. There’s no one answer. In no particular order:

*   **Personal learning.** I pay close attention throughout the year to all of the various performance improvements happening in the release, sometimes from a distance, sometimes as the one making the changes. Writing this post serves as a forcing-function for me to revisit them all and really internalize the changes that were made and their relevance to the broader picture. It’s a learning opportunity for me.
*   **Testing.** As one of the developers on the team recently said to me, “I like this time of the year when you give our optimizations a stress-test and uncover inefficiencies.” Every year when I’m going through the improvements, just the act of re-validating the improvements often highlights regressions, cases that were missed, or further opportunities that can be addressed in the future. Again, it’s a forcing function to do more testing and with a fresh set of eyes.
*   **Thanks.** Many of the performance improvements in each release aren’t from the folks working on the .NET team or even at Microsoft. They’re from passionate and talented individuals throughout the global .NET ecosystem, and I like to highlight their contributions. That’s why throughout the post you see me calling out when PRs are from folks not employed by Microsoft as full-time employees. In this post, that accounts for ~20% of all the cited PRs. Amazing. Heartfelt thanks to everyone who’s worked to make .NET better for everyone.
*   **Excitement.** Developers often have conflicting opinions about the speed at which .NET is advancing, some really appreciating the frequent introduction of new features, others concerned that they can’t keep up with all of the newness. But the one thing everyone seems to agree on is the love of “free perf,” and that’s a lot of what these posts talk about. .NET gets faster and faster every release, and it’s exciting to see a tour through the highlights collected all in one place.
*   **Education.** There are multiple forms of performance improvements covered throughout the post. Some of the improvements you get completely for free just by upgrading the runtime; the implementations in the runtime are better, and so when you run on them, your code just gets better, too. Some of the improvements you get completely for free by upgrading the runtime _and_ recompiling; the C# compiler itself generates better code, often taking advantage of newer surface area exposed in the runtime. And other improvements are new features that, in addition to the runtime and compiler utilizing, you can utilize directly and make your code even faster. Educating about those capabilities and why and where you’d want to utilize them is important to me. But beyond the new features, the techniques employed in making all of the rest of the optimizations throughout the runtime are often more broadly applicable. By learning how these optimizations are applied in the runtime, you can extrapolate and apply similar techniques to your own code, making it that much faster.

If you’ve read this far, I hope you indeed have learned something and are excited about the .NET 9 release. As is likely obvious from my enthusiastic ramblings and awkward poetry, I’m incredibly excited about .NET, everything that’s been achieved in .NET 9, and the future of the platform. If you’re already using .NET 8, upgrading to .NET 9 should be a breeze (the [.NET 9 Release Candidate](https://dotnet.microsoft.com/download/dotnet/9.0) is available for download), and I’d love it if you’d do so and share with us any successes you achieve or issues you face along the way. We’d love to learn from you. And if you have ideas about how to further improve the performance of .NET for .NET 10, please join us in [dotnet/runtime](https://github.com/dotnet/runtime).

Happy coding!

Category

Topics

Author
------

![Stephen Toub - MSFT](https://devblogs.microsoft.com/dotnet/wp-content/uploads/sites/10/2022/03/stoub_square-96x96.jpg)

Partner Software Engineer

Stephen Toub is a developer on the .NET team at Microsoft.