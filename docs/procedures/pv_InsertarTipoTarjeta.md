# SP: pv_InsertarTipoTarjeta
**Tipo**: PV-Insertar
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvTarjetaCreditoExt`](../tables/pvTarjetaCreditoExt.md)
- [`pvTipoTarjeta`](../tables/pvTipoTarjeta.md)
- [`saTarjetaCredito`](../tables/saTarjetaCredito.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pv_InsertarTipoTarjeta]
*DESCRIPCIÓN	: Inserta un registro en la tabla ArtCaracteristica cuando se da entrada
				  o salida una combinacion de sublineas a un articulo
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pv_InsertarTipoTarjeta]
    (
		@sCo_tar		char(6) ,
		@sCo_Tipo_tar	varchar(2),
		@sCo_Us_In		CHAR(6) ,
		@sCo_Us_Mo		CHAR(6) ,
		@sCo_Sucu_In	CHAR(6) ,
		@sCo_Sucu_Mo	CHAR(6) ,
		@sMaquina		VARCHAR(60) = NULL,
		@tsValidador	TIMESTAMP = null
		
    )
AS 
BEGIN
	Declare @fechaLocal as datetime
	Set @fechaLocal = getdate()

	Declare @rowguid_co_tipo_tar uniqueidentifier, @rowguid_co_tar uniqueidentifier

	select @rowguid_co_tipo_tar =  rowguid  from pvTipoTarjeta
		where [TipoTarjeta] = @sCo_Tipo_tar;
    
	select @rowguid_co_tar = rowguid from saTarjetaCredito
		where co_tar = @sCo_tar

	If exists(select * from  dbo.pvTarjetaCreditoExt as a inner join saTarjetaCredito as b on a.rowguid_co_tar = b.rowguid where b.co_tar = @sCo_tar)
	Begin
		Update dbo.pvTarjetaCreditoExt 
			set  rowguid_co_tipo_tar = @rowguid_co_tipo_tar, co_us_mo = @sCo_Us_Mo, fe_us_mo = @fechaLocal, co_sucu_mo = @sCo_Sucu_Mo
			where rowguid_co_tar = @rowguid_co_tar and validador = @tsValidador
			
			if @@rowcount > 0
		Begin
			EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @fechaLocal, @sCo_Sucu = @sCo_Sucu_mo,
				@sTablaOri = 'pvTarjetaCreditoExt', @rowguidOri = @rowguid_co_tipo_tar, @sTipo_Op = 'M', @sMaquina = @sMaquina,
				@sCampos = ''	
		End
	End
	Else
	BEGIN	
		INSERT INTO pvTarjetaCreditoExt (rowguid_co_tar, rowguid_co_tipo_tar, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo )
		VALUES (@rowguid_co_tar, @rowguid_co_tipo_tar, @sCo_Us_In, @sCo_Sucu_In,@fechaLocal, @sCo_Us_in, @sCo_Sucu_in,@fechaLocal)
		
		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @fechaLocal, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'pvTarjetaCreditoExt', @rowguidOri = @rowguid_co_tipo_tar, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = ''	
		
    END
END
```
