# SP: pCostoActualizarEntradaTRAS
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pCostoActualizarEntradaTRAS]
    @RowGuid_Doc_Orig UNIQUEIDENTIFIER ,
    @TipoCosto CHAR(1) = NULL
AS 
    BEGIN

		SET NOCOUNT ON 

        IF ( @TipoCosto IS NULL ) 
            SELECT
                @TipoCosto = i_costo_inventario
            FROM
                par_emp

		Declare @deCostoPromedioEntrada Decimal(18,5)

		Select @deCostoPromedioEntrada = ISNULL(ROUND(SUM(CHS.cantidad * CHE.costo)/SUM(CHS.cantidad),5),0.00000) 
			From saCostoHistoricoSalida CHS 
			INNER JOIN saCostoHistoricoEntrada CHE ON CHS.cod_costo_historico_entrada = CHE.cod_costo_historico_entrada
			Where 
				CHS.doc_orig = @RowGuid_Doc_Orig and CHS.tipo_doc = 'TRAS'

		-- El costo del traslado se actualiza con el costo promedio de las salidas asociadas
		Declare @CoUni char(6)
		Declare @CoArt char(30)

		Select @CoArt = co_art, @CoUni = co_uni from saTrasladoReng where rowguid = @RowGuid_Doc_Orig

		-- Costo base a unidad usada en el renglon
		Set @deCostoPromedioEntrada = ROUND(@deCostoPromedioEntrada * dbo.ArtUnidadBase(@CoArt,@CoUni,1),5)
		Update saTrasladoReng set cost_unit = @deCostoPromedioEntrada where rowguid = @RowGuid_Doc_Orig
		
		-- Se actualiza el costo de las entradas que genera al almacen temporal y destino si aplica
		-- Es el costo del traslado mas los adicionales
		Select @deCostoPromedioEntrada = ROUND((R.cost_unit + R.costo_adi1 + R.costo_adi2 + R.costo_adi3) / dbo.ArtUnidadBase(R.co_art,R.co_uni,1),5) 
			From saTrasladoReng R
			WHERE R.rowguid = @RowGuid_Doc_Orig
		
		Update saCostoHistoricoEntrada set costo = @deCostoPromedioEntrada where doc_orig = @RowGuid_Doc_Orig

    END
```
