# SP: pSeleccionarNotaEntregaVentaNoProcesadasTotalmente
**Tipo**: Seleccionar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saAdiCampo`](../tables/saAdiCampo.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Author,,Name>
-- Create date: <Create Date,,>
-- Description:	<Description,,>
-- =============================================
CREATE PROCEDURE [dbo].[pSeleccionarNotaEntregaVentaNoProcesadasTotalmente]
	(
      @fec_emis smalldatetime =NULL,  -- Valor por defecto: fecha actual
      @total_neto decimal(18,2) = NULL      -- Valor por defecto: 0.05
    )
AS
BEGIN
 set @total_neto = 0.005
	IF @fec_emis IS NULL
        SET @fec_emis = GETDATE();  -- Valor por defecto: fecha actual

	DECLARE @DiasRestriccionNEntrega as int
	select @DiasRestriccionNEntrega=val_entero from saAdiCampo where co_adicampo ='TOP_NEN' 

	select COUNT(*) as 'NumNotasEntregas' , ISNULL(min(fec_emis),'1910-01-01') as 'FechaMinNE' , ISNULL(@DiasRestriccionNEntrega ,30) as 'DiasRestriccionNEntrega' from saNotaEntregaVenta NE
	where NE.status <> 2 and NE.anulado=0
	and NE.fec_emis < @fec_emis
	--and NE.total_neto > @total_neto

END
```
