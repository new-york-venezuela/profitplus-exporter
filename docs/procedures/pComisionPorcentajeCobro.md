# SP: pComisionPorcentajeCobro
**Tipo**: Procedimiento
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saComisionGeneracion`](../tables/saComisionGeneracion.md)
- [`saComisionResultado`](../tables/saComisionResultado.md)
- [`saConsecutivoTipo`](../tables/saConsecutivoTipo.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/***********************************************************************************************
*NOMBRE			:		[pComisionPorcentajeCobro]
*AUTOR			:		SOFTECH SISTEMAS.
*DESCRIPCIÓN	:		Calculo de comisiones de por porcentaje de sobre cobro x Vendedor
************************************************************************************************/

CREATE PROCEDURE [pComisionPorcentajeCobro]
    (
      @dtFecha_d AS DATETIME = NULL ,
      @dtFecha_h AS DATETIME = NULL ,
      @strCo_Ven_d AS CHAR(6) = NULL ,
      @strCo_Ven_h AS CHAR(6) = NULL ,
      @strTipo_Ven_d AS CHAR(4) = NULL ,
      @strTipo_Ven_h AS CHAR(4) = NULL,
      @strSucursal AS CHAR(6) = NULL
    )
AS 
    BEGIN
        DECLARE @strCo_Tipo_comi CHAR(6)
        DECLARE @MensajeError VARCHAR(256)
        DECLARE @dtActual AS DATETIME
        DECLARE @deResultComi DECIMAL(18, 2)
        SET @dtActual = GETDATE()
        SET @strCo_Tipo_comi = 'PORCOB'

        IF ( @dtFecha_d IS NULL ) 
            BEGIN
                SET @MensajeError = 'La fecha desde no puede ser nula.'
                RAISERROR(@MensajeError,16,1)
                RETURN ;
            END

        IF ( @dtFecha_h IS NULL ) 
            BEGIN
                SET @MensajeError = 'La fecha hasta no puede ser nula.'
                RAISERROR(@MensajeError,16,1)
                RETURN ;
            END

        IF ( dbo.existsComisionGenerada(@strCo_Tipo_comi, @dtFecha_d,
                                        @dtFecha_h) IS NOT NULL ) 
            BEGIN
                SET @MensajeError = 'Ya existe una generación de comisión del tipo "'
                    + RTRIM(@strCo_Tipo_comi)
                    + '" para el rango de fecha seleccionado.'
                RAISERROR(@MensajeError,16,1)
                RETURN ;
            END

-- Se crea el registro padre de Generacion de Comision
        DECLARE @strCo_generacion CHAR(20)

        IF (SELECT  UsoSucursal FROM saConsecutivoTipo WHERE co_consecutivo = 'COMIVEN_NUM') = 0
		BEGIN
			 EXEC [dbo].[pConsecutivoProximoOutPut]
		    @sCo_Sucur = '',
            @sCo_Consecutivo = N'COMIVEN_NUM',
            @strConsecutivoResult = @strCo_generacion OUTPUT
		END
		ELSE
		BEGIN
			EXEC [dbo].[pConsecutivoProximoOutPut]
		    @sCo_Sucur = @strSucursal,
            @sCo_Consecutivo = N'COMIVEN_NUM',
            @strConsecutivoResult = @strCo_generacion OUTPUT
		END

        IF ( @strCo_generacion IS NULL
```
