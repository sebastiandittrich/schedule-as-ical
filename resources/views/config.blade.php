<form action="{{ route('config.generate') }}" method="POST">
    @csrf
    <div>Fächer auswählen</div>
    <div>
        @foreach ($classes as $class)
        <div>
            <input type="checkbox" id="classes-{{$class}}" name="classes[]" value="{{$class}}" />
            <label for="classes-{{$class}}">{{$class}}</label>
        </div>
        @endforeach
    </div>
    <br><br>
    <button type="submit">Los</button>
</form>
