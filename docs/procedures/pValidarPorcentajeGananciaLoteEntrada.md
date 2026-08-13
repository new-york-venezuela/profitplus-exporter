# SP: pValidarPorcentajeGananciaLoteEntrada
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pValidarPorcentajeGananciaLoteEntrada
*DESCRIPCIÓN	: Verifica si el precio de un lote cumple con el porcentaje máximo de ganancia establecido.
*AUTOR			: Softech Sistemas
************************************************************************/
CREATE PROCEDURE [dbo].[pValidarPorcentajeGananciaLoteEntrada]
	(
		@gRowGuid_Doc UNIQUEIDENTIFIER ,
		@sTipo_Doc CHAR(4) ,
		@dPrecio DECIMAL(18,5) ,
		@dPorcentaje_Maximo_Ganancia DECIMAL(18, 5) ,
		@bMargen_Ganancia_Costo_A_Precio CHAR(1)
    )
AS
	BEGIN
		SET NOCOUNT ON;

		DECLARE @bFaltanCostos CHAR(1)
		DECLARE @bPorcentajeGananciaSobrepasado CHAR(1)
		DECLARE @dPorcentajeGanancia DECIMAL(18, 5)

		DECLARE @Costo DECIMAL(18, 5)

		SET @bFaltanCostos = 0
		SET @bPorcentajeGananciaSobrepasado = 0

		IF ( @sTipo_Doc = 'COMP' )
			BEGIN
				SET @Costo =
				(
					SELECT
						CHE.costo AS Costo
					FROM
						saFacturaCompraReng AS FCR 
						LEFT JOIN saCostoHistoricoEntrada AS CHE ON FCR.rowguid = CHE.doc_orig
					WHERE
						FCR.rowguid = @gRowGuid_Doc
				)
            END

		ELSE IF ( @sTipo_Doc = 'AJUS' )
			BEGIN
				SET @Costo =
				(
					SELECT
						CHE.costo AS Costo
					FROM
						saAjusteReng AS AJR 
						LEFT JOIN saCostoHistoricoEntrada AS CHE ON AJR.rowguid = CHE.doc_orig
					WHERE
						AJR.rowguid = @gRowGuid_Doc
				)
            END

		ELSE IF ( @sTipo_Doc = 'NREC' )
			BEGIN
				SET @Costo =
				(
					SELECT
						CHE.costo AS Costo
					FROM
						saNotaRecepcionCompraReng AS NRCR
						LEFT JOIN saCostoHistoricoEntrada AS CHE ON NRCR.rowguid = CHE.doc_orig
					WHERE
						NRCR.rowguid = @gRowGuid_Doc
				)
            END

		ELSE IF ( @sTipo_Doc = 'GCOM' )
			BEGIN
				SET @Costo =
				(
					SELECT
						CHE.costo AS Costo
					FROM
						saArtCompuestoGenReng AS ACGR
						LEFT JOIN saCostoHistoricoEntrada AS CHE ON ACGR.rowguid = CHE.doc_orig
					WHERE
						ACGR.rowguid = @gRowGuid_Doc
				)
            END

		ELSE IF ( @sTipo_Doc = 'DCLI' )
			BEGIN
				SET @Costo =
				(
					SELECT
						CHE.costo AS Costo
					FROM
						saDevolucionClienteReng AS DCR 
						LEFT JOIN saCostoHistoricoEntrada AS CHE ON DCR.rowguid = CHE.doc_orig
					WHERE
						DCR.rowguid = @gRowGuid_Doc
				)
            END

		ELSE IF ( @sTipo_Doc = 'TRAS' )
			BEGIN
				SET @Costo =
				(
					SELECT
						CHE.costo AS
```
