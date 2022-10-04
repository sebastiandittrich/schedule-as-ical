<form action="{{ route('config.generate') }}" method="POST">
    @csrf
    <input type="checkbox" name="excludeNKL" id="excludeNKL" />
    <label for="excludeNKL">Nachschreibeklausuren ausblenden</label>
    <br><br>
    <div>Fächer ausschließen</div>
    <div>
        @foreach ($classes as $class)
        <div>
            <input type="checkbox" id="exclude-{{$class}}" name="exclude[]" value="{{$class}}" />
            <label for="exclude-{{$class}}">{{$class}}</label>
        </div>
        @endforeach
    </div>
    <br><br>
    <button type="submit">Los</button>
</form>
